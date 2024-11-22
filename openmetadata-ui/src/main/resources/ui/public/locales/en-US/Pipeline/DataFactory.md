# Data Factory
In this section, we provide guides and references to use the DataFactory connector.

## Requirements

The Ingestion framework uses [Azure Data Factory APIs](https://learn.microsoft.com/en-us/rest/api/datafactory/v2) to connect to the Data Factory and fetch metadata.

You can find further information on the Azure Data Factory connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/datafactory).


## Permissions

Ensure that the service principal or managed identity you’re using has the necessary permissions in the Data Factory resource. (Reader, Contributor or Data Factory Contributor role at minimum).


## Connection Details
$$section
### Subscription ID $(id="subscription_id")
Your Azure subscription’s unique identifier. In the Azure portal, navigate to Subscriptions > Your Subscription > Overview. You’ll see the subscription ID listed there.
$$

$$section
### Resource Group name $(id="resource_group_name")
This is the name of the resource group that contains your Data Factory instance. In the Azure portal, navigate to Resource Groups. Find your resource group, and note the name.
$$

$$section
### Azure Data Factory name $(id="factory_name")
The name of your Data Factory instance. In the Azure portal, navigate to Data Factories and find your Data Factory. The Data Factory name will be listed there.
$$

$$section
### Azure Data Factory pipeline runs day filter $(id="run_filter_days")
The days range when filtering pipeline runs. It specifies how many days back from the current date to look for pipeline runs, and filter runs within the given period of days. Default is `7` days. `Optional`
$$

$$section
### Azure Data Factory Configuration $(id="configSource")
$$

$$section
### Client ID $(id="clientId")
To get the Client ID (also known as application ID), follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. From the Overview section, copy the `Application (client) ID`.

$$

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
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

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
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

