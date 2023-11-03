# Salesforce

In this section, we provide guides and references to use the Salesforce connector.

## Requirements

You will need the following permissions to extract Salesforce metadata:

- **API Access**: You must have the API Enabled permission in your Salesforce organization.
- **Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

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

Salesforce Security Token is required to access the metadata through APIs. You can check out [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.
$$

$$section
### Object Name $(id="sobjectName")

Specify the Salesforce Object Name in case you want to ingest a specific object. If left blank, we will ingest all the Objects.
$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Salesforce, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Salesforce API Version $(id="salesforceApiVersion")

The version of the Salesforce API to use.

Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version.
Enter the numerical value in the field, For example `42.0`.

$$

$$section
### Salesforce Domain $(id="salesforceDomain")

When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
