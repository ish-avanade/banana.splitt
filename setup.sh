#!/usr/bin/env bash
# ============================================================================
# banana/splitt — Azure deployment helper
#
# Wraps Terraform (infrastructure) + zip-deploy (app code) so you can roll out
# either layer independently or together.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$REPO_ROOT/terraform"
DEFAULT_TFVARS="terraform.tfvars"
PLAN_FILE="tfplan"
DEPLOY_ZIP="$REPO_ROOT/deploy.zip"

usage() {
  cat <<'EOF'
Usage: ./setup.sh <command> [options]

Commands:
  plan             Run terraform init/fmt/validate/plan (infra)
  deploy           Deploy infrastructure AND app code (default)
                   Use --infra-only or --app-only to scope the deployment.
  destroy          Destroy Terraform-managed resources
  output           Show Terraform outputs

Options:
  -f, --tfvars FILE        Terraform variables file (default: terraform.tfvars)
  -p, --plan-file FILE     Plan file name to create/use (default: tfplan)
  -a, --auto-approve       Skip approval prompts for apply/destroy
      --infra-only         (deploy) Only run terraform apply, skip app deploy
      --app-only           (deploy) Only zip & deploy app code, skip terraform
      --rg NAME            (deploy --app-only) Override resource group name
      --app NAME           (deploy --app-only) Override App Service name
  -h, --help               Show this help message

Examples:
  ./setup.sh plan
  ./setup.sh deploy                              # infra + app
  ./setup.sh deploy --infra-only --auto-approve  # infra only
  ./setup.sh deploy --app-only                   # zip + deploy code only
  ./setup.sh deploy --tfvars terraform.prod.tfvars
  ./setup.sh destroy --auto-approve
  ./setup.sh output
EOF
}

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: required command '$command_name' is not installed or not on PATH." >&2
    exit 1
  fi
}

ensure_tfvars_exists() {
  local tfvars_file="$1"
  if [[ ! -f "$TERRAFORM_DIR/$tfvars_file" ]]; then
    echo "Error: variables file '$tfvars_file' was not found in $TERRAFORM_DIR." >&2
    echo "Copy terraform.tfvars.example to $tfvars_file and fill in your values first." >&2
    exit 1
  fi
}

ensure_azure_login() {
  if ! az account show >/dev/null 2>&1; then
    echo "Error: Azure CLI is not logged in." >&2
    echo "Run 'az login' and choose the correct subscription before deploying." >&2
    exit 1
  fi
}

run_terraform() {
  (cd "$TERRAFORM_DIR" && terraform "$@")
}

terraform_init_validate() {
  local tfvars_file="$1"
  require_command terraform
  require_command az
  ensure_tfvars_exists "$tfvars_file"
  ensure_azure_login

  echo "==> Initializing Terraform"
  run_terraform init

  echo "==> Formatting Terraform files"
  run_terraform fmt

  echo "==> Validating Terraform configuration"
  run_terraform validate
}

# ----------------------------------------------------------------------------
# Infrastructure (Terraform)
# ----------------------------------------------------------------------------

infra_plan() {
  local tfvars_file="$1" plan_file="$2"
  terraform_init_validate "$tfvars_file"
  echo "==> Creating Terraform plan ($plan_file)"
  run_terraform plan -out="$plan_file" -var-file="$tfvars_file"
}

infra_apply() {
  local tfvars_file="$1" plan_file="$2" auto_approve="$3"
  infra_plan "$tfvars_file" "$plan_file"
  echo "==> Applying Terraform plan"
  if [[ "$auto_approve" == "true" ]]; then
    run_terraform apply -auto-approve "$plan_file"
  else
    run_terraform apply "$plan_file"
  fi
}

infra_destroy() {
  local tfvars_file="$1" auto_approve="$2"
  require_command terraform
  require_command az
  ensure_tfvars_exists "$tfvars_file"
  ensure_azure_login

  echo "==> Initializing Terraform"
  run_terraform init

  echo "==> Destroying Terraform-managed resources"
  if [[ "$auto_approve" == "true" ]]; then
    run_terraform destroy -auto-approve -var-file="$tfvars_file"
  else
    run_terraform destroy -var-file="$tfvars_file"
  fi
}

# ----------------------------------------------------------------------------
# App (zip + deploy)
# ----------------------------------------------------------------------------

build_zip() {
  echo "==> Building deploy.zip"
  rm -f "$DEPLOY_ZIP"
  (cd "$REPO_ROOT" && zip -qr "$DEPLOY_ZIP" . \
    -x '.git/*' \
       'node_modules/*' \
       'terraform/*' \
       '.devcontainer/*' \
       'data/*' \
       '.env' '.env.*' \
       'tests/*' \
       '.github/*' \
       'deploy.zip')
  echo "    deploy.zip: $(du -h "$DEPLOY_ZIP" | cut -f1)"
}

resolve_target() {
  # Sets globals: APP_RESOURCE_GROUP, APP_NAME
  if [[ -n "${OVERRIDE_RG:-}" ]]; then
    APP_RESOURCE_GROUP="$OVERRIDE_RG"
  else
    APP_RESOURCE_GROUP="$(run_terraform output -raw resource_group_name 2>/dev/null || true)"
  fi
  if [[ -n "${OVERRIDE_APP:-}" ]]; then
    APP_NAME="$OVERRIDE_APP"
  else
    APP_NAME="$(run_terraform output -raw app_service_name 2>/dev/null || true)"
  fi

  if [[ -z "$APP_RESOURCE_GROUP" || -z "$APP_NAME" ]]; then
    echo "Error: could not determine target resource group / app name." >&2
    echo "Run 'terraform apply' first, or pass --rg <name> --app <name>." >&2
    exit 1
  fi
}

app_deploy() {
  require_command az
  require_command zip
  ensure_azure_login

  resolve_target
  build_zip

  echo "==> Deploying to App Service: $APP_NAME (rg: $APP_RESOURCE_GROUP)"
  az webapp deploy \
    --resource-group "$APP_RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src-path "$DEPLOY_ZIP" \
    --type zip

  echo "==> Deployment finished"
  url="$(run_terraform output -raw app_service_url 2>/dev/null || echo "https://${APP_NAME}.azurewebsites.net")"
  echo "    App URL: $url"

  echo "==> Cleaning up deploy.zip"
  rm -f "$DEPLOY_ZIP"
}

# ----------------------------------------------------------------------------
# Argument parsing
# ----------------------------------------------------------------------------

command_name="deploy"
tfvars_file="$DEFAULT_TFVARS"
plan_file="$PLAN_FILE"
auto_approve="false"
infra_only="false"
app_only="false"
OVERRIDE_RG=""
OVERRIDE_APP=""

if [[ $# -gt 0 && "$1" != -* ]]; then
  command_name="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--tfvars)         tfvars_file="$2"; shift 2 ;;
    -p|--plan-file)      plan_file="$2"; shift 2 ;;
    -a|--auto-approve)   auto_approve="true"; shift ;;
    --infra-only)        infra_only="true"; shift ;;
    --app-only)          app_only="true"; shift ;;
    --rg)                OVERRIDE_RG="$2"; shift 2 ;;
    --app)               OVERRIDE_APP="$2"; shift 2 ;;
    -h|--help)           usage; exit 0 ;;
    *)
      echo "Error: unknown option '$1'." >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$infra_only" == "true" && "$app_only" == "true" ]]; then
  echo "Error: --infra-only and --app-only are mutually exclusive." >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# Dispatch
# ----------------------------------------------------------------------------

case "$command_name" in
  plan)
    infra_plan "$tfvars_file" "$plan_file"
    ;;
  deploy)
    if [[ "$app_only" == "true" ]]; then
      app_deploy
    elif [[ "$infra_only" == "true" ]]; then
      infra_apply "$tfvars_file" "$plan_file" "$auto_approve"
    else
      infra_apply "$tfvars_file" "$plan_file" "$auto_approve"
      app_deploy
    fi
    ;;
  destroy)
    infra_destroy "$tfvars_file" "$auto_approve"
    ;;
  output)
    require_command terraform
    echo "==> Terraform outputs"
    run_terraform output
    ;;
  *)
    echo "Error: unknown command '$command_name'." >&2
    usage >&2
    exit 1
    ;;
esac
