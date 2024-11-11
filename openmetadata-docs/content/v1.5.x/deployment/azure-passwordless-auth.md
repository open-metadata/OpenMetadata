---
title: Azure - Enable Passwordless Database Backend Connection
slug: /deployment/azure-passwordless-auth
collate: false
---

# Azure - Enable Passwordless Database Backend Connection

By Default, OpenMetadata supports basic authentication when connecting to MySQL/PostgreSQL as Database backend. With Azure, you can enhance the security for configuring Database configurations other the basic authentication mechanism.
This guide will help you setup the application to use passwordless approach for Azure PaaS Databases (preferrably [Azure Database for PostgreSQL - Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/service-overview) and [Azure Database for MySQL - Flexible Server](https://learn.microsoft.com/en-us/azure/mysql/flexible-server/overview)).

# Prerequisites

This guide requires the following prerequisites -

- Azure Database Flexible Server enabled with Microsoft Entra authentication
- [Azure Managed Identities](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
- Azure Kubernetes Service (Enabled with Workload Identity) or Azure VM
- OpenMetadata Application Version `1.5.9` and higher

If you are looking to enable Passwordless Database Backend Configuration on Existing OpenMetadata Application hosted using Azure Cloud, you need to create perform the following prerequisites -

- Create Managed Identity from Azure Portal
- Create a SQL User for Managed Identity in Azure Databases
    - PostgreSQL Reference link [here](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/how-to-manage-azure-ad-users#create-a-userrole-using-microsoft-entra-principal-name)
    - MySQL Reference link [here](https://learn.microsoft.com/en-us/azure/mysql/flexible-server/how-to-azure-ad#create-microsoft-entra-users-in-azure-database-for-mysql)
- Assign Existing OpenMetadata Database Tables Ownership to Managed Identities created in above step

# Enabling Passwordless connections with OpenMetadata

Configure your Helm Values for Kubernetes Deployment like below -

```yaml
# For PostgreSQL
commonLabels:
  azure.workload.identity/use: "true"
serviceAccount:
  create: true
  annotations:
    azure.workload.identity/client-id: <USER_MANAGED_IDENTITY_CLIENT_ID>
  name: "openmetadata-sa"
automountServiceAccountToken: true
openmetadata:
  config:
    database:
      host: <HOST_NAME>
      driverClass: org.postgresql.Driver
      dbParams: "azure=true&allowPublicKeyRetrieval=true&serverTimezone=UTC&sslmode=require&authenticationPluginClassName=com.azure.identity.extensions.jdbc.postgresql.AzurePostgresqlAuthenticationPlugin"
      dbScheme: postgresql
      port: 5432
      auth:
        username: <USER_MANAGED_IDENTITY_NAME>
        password:
          secretRef: database-secrets
          secretKey: openmetadata-database-password
      databaseName: <DATABASE_NAME>

# For MySQL
commonLabels:
  azure.workload.identity/use: "true"
serviceAccount:
  create: true
  annotations:
    azure.workload.identity/client-id: <USER_MANAGED_IDENTITY_CLIENT_ID>
  name: "openmetadata-sa"
automountServiceAccountToken: true
openmetadata:
  config:
    database:
      host: <HOST_NAME>
      driverClass: com.mysql.cj.jdbc.Driver
      dbParams: "azure=true&allowPublicKeyRetrieval=trueserverTimezone=UTC&sslMode=REQUIRED&defaultAuthenticationPlugin=com.azure.identity.extensions.jdbc.mysql.AzureMysqlAuthenticationPlugin"
      dbScheme: mysql
      port: 3306
      auth:
        username: <USER_MANAGED_IDENTITY_NAME>
        password:
          secretRef: database-secrets
          secretKey: openmetadata-database-password
      databaseName: <DATABASE_NAME>
```
{% note %}

In the above code snippet, the Database Credentials (Auth Password Kubernetes Secret) is still required and cannot be empty. Set it to dummy / random value.

{% /note %}

Install / Upgrade your Helm Release with the following command -

```bash
helm repo update open-metadata
helm upgrade --install openmetadata open-metadata/openmetadata --values <OPENMETADATA_HELM_VALUES_FILE_PATH>
```

For further reference, checkout the official documentation available in the below links -

- [MySQL](https://learn.microsoft.com/en-us/azure/developer/java/spring-framework/migrate-mysql-to-passwordless-connection?tabs=sign-in-azure-cli%2Cjava%2Capp-service)
- [PostgreSQL](https://learn.microsoft.com/en-us/azure/developer/java/spring-framework/migrate-postgresql-to-passwordless-connection?tabs=sign-in-azure-cli%2Cjava%2Capp-service%2Cassign-role-service-connector)
