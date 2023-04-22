# Salesforce

In this section, we provide guides and references to use the Salesforce connector.

## Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with custom Airflow plugins to handle the workflow deployment.

Following are the permissions you will require to fetch the metadata from Salesforce.

**API Access**: You must have the API Enabled permission in your Salesforce organization.

**Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

You can find further information on the Salesforce connector in the [docs](https://docs.open-metadata.org/connectors/database/salesforce).

## Connection Details

$$section
### Username $(id="username")

Username to connect to the Salesforce. This user should have the access as defined in requirements.
$$

$$section
### Password $(id="password")

Password to connect to the Salesforce.
$$

$$section
### Security Token $(id="securityToken")

Salesforce Security Token is required to access the metadata through APIs. You can checkout [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.
$$

$$section
### Object Name $(id="sobjectName")

Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.
$$

$$section
### Database Name $(id="databaseName")

Optional display name to give to the database in OpenMetadata. If left blank, we will use `default` as the database name.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
