# Terraform Remote State Setup

## Option 1: Local State (Development Only)

**Pros:**
- Simple, no setup required
- Works immediately with `terraform init`

**Cons:**
- ⚠️ **NOT recommended for production**
- State file contains sensitive data (passwords, keys)
- Cannot share with team
- Risk of accidental deletion or corruption
- No locking mechanism → conflicts with team collaboration

**Use case:** Local development only

---

## Option 2: Azure Storage Account (Recommended)

**Pros:**
- Secure, encrypted at rest
- Enables team collaboration
- Built-in locking to prevent concurrent modifications
- Audit logging via Azure Storage
- Same Azure subscription, no extra vendor

**Cons:**
- Small setup cost (~$1/month)
- Requires initial setup before first plan

### Setup Steps:

#### 1. Create Storage Account for State (One-time setup)

```bash
# Set variables
RESOURCE_GROUP="rg-terraform-state"
STORAGE_ACCOUNT="tfstate$(date +%s | tail -c 6)"  # Unique name
CONTAINER_NAME="tfstate"
LOCATION="East US"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true

# Create container
az storage container create \
  --account-name $STORAGE_ACCOUNT \
  --name $CONTAINER_NAME

# Enable versioning (for rollback)
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --enable-versioning

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query '[0].value' -o tsv)

echo "Storage Account: $STORAGE_ACCOUNT"
echo "Resource Group: $RESOURCE_GROUP"
echo "Key: $STORAGE_KEY"
```

#### 2. Uncomment backend config in `main.tf`

```hcl
backend "azurerm" {
  resource_group_name  = "rg-terraform-state"
  storage_account_name = "tfstate<YOUR_SUFFIX>"
  container_name       = "tfstate"
  key                  = "banana-splitt.tfstate"
}
```

#### 3. Authenticate and Initialize

```bash
# Option A: Using Azure CLI (recommended)
az login

# Option B: Using service principal
export ARM_CLIENT_ID="..."
export ARM_CLIENT_SECRET="..."
export ARM_SUBSCRIPTION_ID="..."
export ARM_TENANT_ID="..."

# Set storage account key for backend
export ARM_ACCESS_KEY="<storage_key_from_above>"

# Re-initialize Terraform
terraform init

# Answer "yes" to migrate state from local to remote
```

#### 4. Verify state is in Azure

```bash
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name $CONTAINER_NAME
```

---

## Option 3: Terraform Cloud (Alternative)

**Pros:**
- Free tier (unlimited state files)
- Best UI for viewing state
- Remote run capability
- VCS integration

**Cons:**
- External service (outside Azure)
- Requires account at terraform.io

### Quick Setup:

1. Sign up at https://app.terraform.io
2. Create organization and API token
3. Add to `main.tf`:
```hcl
terraform {
  cloud {
    organization = "YOUR_ORG_NAME"
    workspaces {
      name = "banana-splitt"
    }
  }
}
```
4. Run `terraform login` and paste token
5. Run `terraform init`

---

## Security Best Practices

Whichever option you choose:

1. **Never commit state files to Git**
   ```bash
   echo "terraform.tfstate" >> .gitignore
   echo "terraform.tfstate.*.backup" >> .gitignore
   echo ".terraform/console_history" >> .gitignore
   echo "terraform.tfvars" >> .gitignore
   ```

2. **Lock sensitive values with `sensitive = true`**
   - Already done in `variables.tf` for: passwords, secrets, client IDs

3. **Enable audit logging** (Azure Storage)
   - Automatically enabled for Azure Storage backend

4. **Restrict access to state file**
   ```bash
   # For storage account
   az storage account update \
     --name $STORAGE_ACCOUNT \
     --resource-group $RESOURCE_GROUP \
     --default-action Deny
   
   # Whitelist your IP
   az storage account network-rule add \
     --account-name $STORAGE_ACCOUNT \
     --resource-group $RESOURCE_GROUP \
     --ip-address <YOUR_IP>/32
   ```

---

## Recommendation for banana.splitt

**Development:** Local state (`.gitignore` it!)
**Staging:** Azure Storage backend
**Production:** Azure Storage backend + Additional access controls

```bash
# Create separate tfvars for each environment
terraform.tfvars          # .gitignored - local development
terraform.dev.tfvars      # Checked in for reference
terraform.staging.tfvars  # Checked in for reference
terraform.prod.tfvars     # NOT checked in (sensitive!)
```

Deploy each environment:
```bash
terraform apply -var-file="terraform.dev.tfvars"
terraform apply -var-file="terraform.staging.tfvars"
terraform apply -var-file="terraform.prod.tfvars"
```
