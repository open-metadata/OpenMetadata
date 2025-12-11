# ADLS

In this section, we provide guides and references to use the ADLS connector.

By default, the ADLS connector will ingest only top-level containers (Buckets). If you want to extract any information from within and their data models, you can follow the <a href="https://docs.open-metadata.org/connectors/storage" target="_blank">docs</a>.

## Requirements

We need the following permissions in AWS:

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor

You can find further information on the Kafka connector in the <a href="https://docs.open-metadata.org/connectors/storage/adls" target="_blank">docs</a>.

## Connection Details

$$section
### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.
$$


$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.

$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Account Name $(id="accountName")

Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.
$$

$$section
### Key Vault Name $(id="vaultName")

Azure Key Vault serves as a centralized secrets manager, securely storing and managing sensitive information, such as connection strings and cryptographic keys.

$$

