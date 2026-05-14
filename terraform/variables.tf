variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-banana-splitt"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "East US"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "app_name" {
  description = "Name of the web app"
  type        = string
  default     = "banana-splitt-app"
}

variable "app_service_sku" {
  description = "App Service plan SKU"
  type        = string
  default     = "B1"
  validation {
    condition     = contains(["B1", "B2", "B3", "S1", "S2", "S3"], var.app_service_sku)
    error_message = "Valid SKUs are B1, B2, B3, S1, S2, S3."
  }
}

variable "sql_server_name" {
  description = "SQL Server name (must be globally unique)"
  type        = string
  validation {
    condition     = length(var.sql_server_name) >= 3 && length(var.sql_server_name) <= 63
    error_message = "SQL Server name must be 3-63 characters."
  }
}

variable "sql_database_name" {
  description = "SQL Database name"
  type        = string
  default     = "banana_splitt_db"
}

variable "sql_database_sku" {
  description = "SQL Database SKU"
  type        = string
  default     = "Basic"
  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.sql_database_sku)
    error_message = "Valid SKUs are Basic, Standard, Premium."
  }
}

variable "sql_admin_username" {
  description = "SQL Server admin username"
  type        = string
  default     = "sqladmin"
  sensitive   = true
}

variable "key_vault_name" {
  description = "Key Vault name (must be globally unique)"
  type        = string
  validation {
    condition     = length(var.key_vault_name) >= 3 && length(var.key_vault_name) <= 24
    error_message = "Key Vault name must be 3-24 characters."
  }
}

variable "storage_account_name" {
  description = "Storage account name (must be globally unique, lowercase)"
  type        = string
  default     = ""
  validation {
    condition     = var.storage_account_name == "" || (length(var.storage_account_name) >= 3 && length(var.storage_account_name) <= 24)
    error_message = "Storage account name must be 3-24 characters if provided."
  }
}

variable "create_storage_account" {
  description = "Whether to create a storage account"
  type        = bool
  default     = false
}

variable "github_client_id" {
  description = "GitHub OAuth App client ID"
  type        = string
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth App client secret"
  type        = string
  sensitive   = true
}

# ----------------------------------------------------------------------------
# AI provider (optional) — set EITHER the OpenAI vars OR the Azure OpenAI vars
# ----------------------------------------------------------------------------
variable "openai_api_key" {
  description = "Direct OpenAI API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openai_model" {
  description = "OpenAI model name (optional, e.g. gpt-4o-mini)"
  type        = string
  default     = ""
}

variable "azure_openai_api_key" {
  description = "Azure OpenAI API key (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "azure_openai_endpoint" {
  description = "Azure OpenAI endpoint, e.g. https://my-resource.openai.azure.com (optional)"
  type        = string
  default     = ""
}

variable "azure_openai_deployment" {
  description = "Azure OpenAI deployment name (optional)"
  type        = string
  default     = ""
}

variable "azure_openai_api_version" {
  description = "Azure OpenAI API version (optional, defaults to 2024-08-01-preview if endpoint is set)"
  type        = string
  default     = ""
}

variable "dev_ip" {
  description = "Developer IP address for SQL firewall (optional)"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain name (optional)"
  type        = string
  default     = ""
}
