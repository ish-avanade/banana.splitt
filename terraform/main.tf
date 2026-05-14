terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # Uncomment this block after creating Azure Storage for state
  # backend "azurerm" {
  #   resource_group_name  = "rg-terraform-state"
  #   storage_account_name = "tfstate<random>"
  #   container_name       = "tfstate"
  #   key                  = "banana-splitt.tfstate"
  # }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
  }
}

# Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "banana-splitt"
  }
}

# App Service Plan
resource "azurerm_service_plan" "app_plan" {
  name                = "${var.app_name}-plan"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = azurerm_resource_group.rg.tags
}

# App Service (Web App)
resource "azurerm_linux_web_app" "app" {
  name                = var.app_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = azurerm_service_plan.app_plan.id

  https_only = true

  app_settings = merge({
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"   = "false"
    "PORT"                                  = "3000"
    "NODE_ENV"                              = var.environment
    "SCM_DO_BUILD_DURING_DEPLOYMENT"        = "true"
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.insights.connection_string
    "SQL_CONNECTION_STRING"                 = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.sql_conn_string.id})"
    "GITHUB_CLIENT_ID"                      = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_client_id.id})"
    "GITHUB_CLIENT_SECRET"                  = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.github_client_secret.id})"
    "JWT_SECRET"                            = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.jwt_secret.id})"
    },
    # Direct OpenAI (only if openai_api_key is set)
    var.openai_api_key != "" ? {
      "OPENAI_API_KEY" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.openai_api_key[0].id})"
    } : {},
    var.openai_model != "" ? { "OPENAI_MODEL" = var.openai_model } : {},
    # Azure OpenAI (only if azure_openai_api_key is set)
    var.azure_openai_api_key != "" ? {
      "AZURE_OPENAI_API_KEY" = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.azure_openai_api_key[0].id})"
    } : {},
    var.azure_openai_endpoint != "" ? { "AZURE_OPENAI_ENDPOINT" = var.azure_openai_endpoint } : {},
    var.azure_openai_deployment != "" ? { "AZURE_OPENAI_DEPLOYMENT" = var.azure_openai_deployment } : {},
    var.azure_openai_api_version != "" ? { "AZURE_OPENAI_API_VERSION" = var.azure_openai_api_version } : {},
  )

  site_config {
    minimum_tls_version = "1.2"
    use_32_bit_worker   = false

    application_stack {
      node_version = "20-lts"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  tags = azurerm_resource_group.rg.tags
}

# Application Insights
resource "azurerm_application_insights" "insights" {
  name                = "${var.app_name}-insights"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  application_type    = "web"
  retention_in_days   = 30

  tags = azurerm_resource_group.rg.tags

  lifecycle {
    # Azure auto-binds a Log Analytics workspace; once set it cannot be removed.
    ignore_changes = [workspace_id, tags]
  }
}

# SQL Server
resource "azurerm_mssql_server" "sql_server" {
  name                         = var.sql_server_name
  resource_group_name          = azurerm_resource_group.rg.name
  location                     = azurerm_resource_group.rg.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_username
  administrator_login_password = random_password.sql_admin_password.result

  minimum_tls_version = "1.2"

  tags = azurerm_resource_group.rg.tags
}

# SQL Database
resource "azurerm_mssql_database" "db" {
  name           = var.sql_database_name
  server_id      = azurerm_mssql_server.sql_server.id
  collation      = "SQL_Latin1_General_CP1_CI_AS"
  license_type   = "LicenseIncluded"
  sku_name       = var.sql_database_sku
  zone_redundant = false

  tags = azurerm_resource_group.rg.tags
}

# SQL Firewall Rule - Allow Azure Services
resource "azurerm_mssql_firewall_rule" "allow_azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.sql_server.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# SQL Firewall Rule - Allow Local Dev (optional - replace with your IP)
resource "azurerm_mssql_firewall_rule" "allow_local_dev" {
  count            = var.dev_ip != "" ? 1 : 0
  name             = "AllowLocalDev"
  server_id        = azurerm_mssql_server.sql_server.id
  start_ip_address = var.dev_ip
  end_ip_address   = var.dev_ip
}

# Key Vault
resource "azurerm_key_vault" "kv" {
  name                        = var.key_vault_name
  location                    = azurerm_resource_group.rg.location
  resource_group_name         = azurerm_resource_group.rg.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  enabled_for_disk_encryption = false
  purge_protection_enabled    = var.environment == "prod" ? true : false
  soft_delete_retention_days  = 7

  tags = azurerm_resource_group.rg.tags
}

# Key Vault Access Policy for Terraform caller (admin/deployer)
resource "azurerm_key_vault_access_policy" "deployer_kv_access" {
  key_vault_id = azurerm_key_vault.kv.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Get",
    "List",
    "Set",
    "Delete",
    "Purge"
  ]
}

# Key Vault Access Policy for App Service
resource "azurerm_key_vault_access_policy" "app_kv_access" {
  key_vault_id       = azurerm_key_vault.kv.id
  tenant_id          = data.azurerm_client_config.current.tenant_id
  object_id          = azurerm_linux_web_app.app.identity[0].principal_id
  secret_permissions = ["Get", "List"]
}

# Generate random SQL admin password
resource "random_password" "sql_admin_password" {
  length  = 32
  special = true
}

# Generate random JWT secret
resource "random_password" "jwt_secret" {
  length  = 32
  special = true
}

# Key Vault Secrets
resource "azurerm_key_vault_secret" "sql_conn_string" {
  name         = "sql-connection-string"
  value        = "Server=tcp:${azurerm_mssql_server.sql_server.fully_qualified_domain_name},1433;Initial Catalog=${azurerm_mssql_database.db.name};Persist Security Info=False;User ID=${var.sql_admin_username};Password=${random_password.sql_admin_password.result};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "github_client_id" {
  name         = "github-client-id"
  value        = var.github_client_id
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "github_client_secret" {
  name         = "github-client-secret"
  value        = var.github_client_secret
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt_secret.result
  key_vault_id = azurerm_key_vault.kv.id
}

# AI provider secrets (only created when the corresponding tfvar is set)
resource "azurerm_key_vault_secret" "openai_api_key" {
  count        = var.openai_api_key != "" ? 1 : 0
  name         = "openai-api-key"
  value        = var.openai_api_key
  key_vault_id = azurerm_key_vault.kv.id
}

resource "azurerm_key_vault_secret" "azure_openai_api_key" {
  count        = var.azure_openai_api_key != "" ? 1 : 0
  name         = "azure-openai-api-key"
  value        = var.azure_openai_api_key
  key_vault_id = azurerm_key_vault.kv.id
}

# Storage Account (optional, for logs/backups)
resource "azurerm_storage_account" "storage" {
  count                      = var.create_storage_account ? 1 : 0
  name                       = var.storage_account_name
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  account_tier               = "Standard"
  account_replication_type   = "LRS"
  https_traffic_only_enabled = true

  tags = azurerm_resource_group.rg.tags
}

# Data source for current Azure context
data "azurerm_client_config" "current" {}
