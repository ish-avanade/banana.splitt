# Terraform Configuration for banana.splitt on Azure

This directory contains Infrastructure-as-Code (IaC) to provision all Azure resources needed to host banana.splitt.

## Resources Created

- **Resource Group** — logical container for all resources
- **App Service Plan & Web App** — Linux-based hosting for Node.js app
- **SQL Server & Database** — for trip, expense, and user data
- **Key Vault** — secure storage for secrets (OAuth credentials, JWT keys, DB credentials)
- **Application Insights** — monitoring and logging
- **Storage Account** (optional) — for backups/logs

## Quick Start

### 1. Prerequisites

```bash
# Install Terraform
brew install terraform  # macOS
# OR visit https://www.terraform.io/downloads.html

# Install Azure CLI
brew install azure-cli

# Authenticate with Azure
az login
az account show  # Verify correct subscription
```

### 2. Set Up Configuration

```bash
# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required values:**
- `sql_server_name` — Must be globally unique (e.g., "banana-splitt-sql-myname")
- `key_vault_name` — Must be globally unique and 3-24 chars (e.g., "banana-kv-myname")
- `github_client_id` — From your GitHub OAuth App registration
- `github_client_secret` — From your GitHub OAuth App registration

> The deploy/plan/destroy wrapper script lives at the **repo root** as
> [`../setup.sh`](../setup.sh). It also handles app-code zip deployment.
> See the [Deploying to Azure](../README.md#deploying-to-azure) section in
> the root README for the full workflow.

### 3. Set Up Remote State (Recommended)

For team collaboration and production use:

```bash
cat remote_state_setup.md  # Read and follow these instructions
```

For now, local state is fine for development.

### 4. Plan Deployment

```bash
# From the repo root — wrapper handles init/fmt/validate/plan
./setup.sh plan

# Or run terraform directly from this directory
cd terraform
terraform init
terraform plan -out=tfplan
```

### 5. Apply Configuration

```bash
# Recommended: use the wrapper from the repo root
./setup.sh deploy --infra-only --auto-approve

# Or apply directly with terraform
cd terraform
terraform apply tfplan
```

**Wait 5-10 minutes for resources to provision.**

### 6. Verify Deployment

```bash
# Get output values
terraform output

# Output will include:
# - App Service URL
# - SQL Server connection string
# - Key Vault name
# - Resource group name
```

### 7. Connect App Service to GitHub (Optional)

Enable continuous deployment from GitHub:

```bash
az webapp deployment github-actions add \
  --repo USERNAME/REPO \
  --branch main \
  --runtime "node|20-lts" \
  --resource-group rg-banana-splitt \
  --name banana-splitt-app
```

---

## File Structure

```
terraform/
├── main.tf                    # Main resource definitions
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── terraform.tfvars.example   # Example config (copy & edit)
├── remote_state_setup.md      # Guide for remote state setup
├── README.md                  # This file
└── .gitignore                 # Don't commit sensitive files!

../setup.sh                    # Repo-root wrapper for infra + app deploy
```

---

## State File Management

### Local State (Development)
- State stored in `terraform.tfstate` (local machine)
- **IMPORTANT:** Add to `.gitignore`
- ✅ Simple for dev
- ❌ Not safe for production or team use

### Remote State (Recommended for Production)
- State stored in Azure Storage Account
- ✅ Secure, team-accessible, locked
- ❌ Requires setup

See [remote_state_setup.md](./remote_state_setup.md) for detailed instructions.

---

## Common Commands

```bash
# Wrapper (run from the repo root) — handles infra + app-code deploys
./setup.sh plan --tfvars terraform.dev.tfvars
./setup.sh deploy --tfvars terraform.dev.tfvars              # infra + app
./setup.sh deploy --infra-only --tfvars terraform.dev.tfvars # infra only
./setup.sh deploy --app-only                                 # app code only
./setup.sh destroy --tfvars terraform.dev.tfvars

# Direct terraform commands (from this directory)
terraform fmt
terraform validate
terraform show
terraform destroy
terraform destroy -target=azurerm_linux_web_app.app
terraform refresh
terraform force-unlock <LOCK_ID>
```

---

## Environment-Specific Configs

Create separate `.tfvars` files for each environment:

```bash
terraform.dev.tfvars       # Development
terraform.staging.tfvars   # Staging
terraform.prod.tfvars      # Production

# Apply each:
terraform apply -var-file="terraform.dev.tfvars"
terraform apply -var-file="terraform.prod.tfvars"
```

---

## Troubleshooting

### "Storage account name already exists"
- Storage account names are globally unique across Azure
- Try: `storage_account_name = "bananasplitt$(date +%s | tail -c 5)"`

### "Key Vault name already exists"
- Same issue — Key Vault names are globally unique
- Add a suffix: `key_vault_name = "banana-kv-${random_string.suffix.result}"`

### "SQL Server name already exists"
- SQL Server names are globally unique
- Add timestamp: `sql_server_name = "banana-sql-${formatdate("MMDD-hhmm", timestamp())}"`

### Permission Denied when running terraform
```bash
# Ensure you're authenticated
az login

# Verify correct subscription
az account show

# Switch subscription if needed
az account set --subscription "SUBSCRIPTION_ID"
```

### State file conflicts
```bash
# Ensure backend is configured correctly
terraform init -reconfigure

# Check who has locks
terraform force-unlock <LOCK_ID>
```

---

## Costs

**Estimated monthly costs (Azure):**
- App Service B1: ~$10
- SQL Database Basic: ~$5
- Key Vault: ~$0.50
- Application Insights: Free tier
- Storage Account (optional): ~$1
- **Total: ~$15-20/month**

Scale up as needed:
- **S1**: ~$60/month
- **Premium (P1V2)**: ~$100+/month

---

## Next Steps

1. ✅ Configure `terraform.tfvars`
2. ✅ Run `terraform plan` and review
3. ✅ Run `terraform apply`
4. ✅ Update app backend with database connection
5. ✅ Set up GitHub Actions for CI/CD
6. ✅ Configure custom domain and SSL

See the main project README for backend migration steps.

---

## Support

For issues:
1. Check `terraform plan` output for errors
2. Review Azure Portal for resource status
3. Check Application Insights logs in Azure Portal
4. Run `terraform refresh` to sync state

For Terraform docs: https://www.terraform.io/docs/
For Azure provider docs: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs
