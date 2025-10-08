# Unity Catalog

In this section, we provide guides and references to use the Unity Catalog connector. You can view the full documentation for Unity Catalog <a href="https://docs.open-metadata.org/connectors/database/unity-catalog" target="_blank">here</a>.

## Requirements

To learn more about the Unity Catalog Connection Details (`hostPort`,`token`, `http_path`) information visit these <a href="https://docs.open-metadata.org/connectors/database/unity-catalog/troubleshooting" target="_blank">docs</a>.

$$note
We support Databricks runtime version 9 and above.
$$

### Usage & Lineage

$$note
To get Query Usage and Lineage details, you need a Databricks Premium account, since we will be extracting this information from your SQL Warehouse's history API.
$$

You can find further information on the Unity Catalog connector in the <a href="https://docs.open-metadata.org/connectors/database/unity-catalog" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the Databricks instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `adb-xyz.azuredatabricks.net:443`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3000` as the value.
$$

$$section
### Authentication Type $(id="authType")
Select the authentication method to connect to your Databricks workspace.

- **Personal Access Token**: Generated Personal Access Token for Databricks workspace authentication.

- **Databricks OAuth**: OAuth2 Machine-to-Machine authentication using a Service Principal.

- **Azure AD Setup**: Specifically for Azure Databricks workspaces that use Azure Active Directory for identity management. Uses Azure Service Principal authentication through Azure AD.
$$

$$section
### Token $(id="token")
Personal Access Token (PAT) for authenticating with Databricks workspace.
(e.g., `dapi1234567890abcdef`)
$$

$$section
### Client ID $(id="clientId")
The Application ID of your Databricks Service Principal for OAuth2 authentication.
(e.g., `12345678-1234-1234-1234-123456789abc`)
$$

$$section
### Client Secret $(id="clientSecret")
OAuth secret for the Databricks Service Principal.
$$

$$section
### Azure Client ID $(id="azureClientId")
Azure Active Directory Application (client) ID for Azure Databricks authentication.
(e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
$$

$$section
### Azure Client Secret $(id="azureClientSecret")
Secret key for the Azure AD Application.
$$

$$section
### Azure Tenant ID $(id="azureTenantId")
Your Azure Active Directory tenant identifier.
(e.g., `98765432-dcba-4321-abcd-1234567890ab`)
$$


$$section
### HTTP Path $(id="httpPath")
Databricks compute resources URL. E.g., `/sql/1.0/warehouses/xyz123`.
$$

$$section
### Catalog $(id="catalog")
Catalog of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalogs. E.g., `hive_metastore`
$$

$$section
### Database Schema $(id="databaseSchema")
Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
$$

$$section
### Connection Timeout $(id="connectionTimeout")
The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.

If your connection fails because your cluster has not had enough time to start, you can try updating this parameter with a bigger number.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
