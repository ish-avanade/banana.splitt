output "app_service_url" {
  description = "URL of the deployed App Service"
  value       = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "app_service_name" {
  description = "Name of the App Service"
  value       = azurerm_linux_web_app.app.name
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.rg.name
}

output "sql_server_fully_qualified_domain_name" {
  description = "Fully qualified domain name of SQL Server"
  value       = azurerm_mssql_server.sql_server.fully_qualified_domain_name
}

output "sql_database_name" {
  description = "Name of the SQL Database"
  value       = azurerm_mssql_database.db.name
}

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.kv.id
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key for Application Insights"
  value       = azurerm_application_insights.insights.instrumentation_key
  sensitive   = true
}

output "storage_account_id" {
  description = "ID of the storage account (if created)"
  value       = var.create_storage_account ? azurerm_storage_account.storage[0].id : null
}

output "sql_admin_username" {
  description = "SQL Server admin username"
  value       = var.sql_admin_username
  sensitive   = true
}

output "connection_info" {
  description = "Connection information for accessing resources"
  value = {
    app_url             = "https://${azurerm_linux_web_app.app.default_hostname}"
    sql_server          = azurerm_mssql_server.sql_server.fully_qualified_domain_name
    database_name       = azurerm_mssql_database.db.name
    key_vault_name      = azurerm_key_vault.kv.name
    resource_group      = azurerm_resource_group.rg.name
    app_insights_app_id = azurerm_application_insights.insights.app_id
  }
}
