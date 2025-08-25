
# Salesforce

In this section, we provide guides and references to use the Salesforce connector.

## Requirements

You will need the following permissions to extract Salesforce metadata:

- **API Access**: You must have the API Enabled permission in your Salesforce organization.
- **Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

You can find further information on the Salesforce connector in the <a href="https://docs.open-metadata.org/connectors/database/salesforce" target="_blank">docs</a>.

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

Salesforce Security Token is required to access the metadata through APIs. You can check out <a href="https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5" target="_blank">this doc</a> on how to get the security token.
$$

$$section
### Organization ID $(id="organizationId")

Salesforce Organization ID is the unique identifier for your Salesforce identity. You can check out <a href="https://help.salesforce.com/s/articleView?id=000385215&type=1" target="_blank">this doc</a> on how to get the your Salesforce Organization ID.

**Note**: You need to provide `15` digit organization id in this section. for e.g. `00DIB000004nDEq`, which you can find by following the steps mentioned in above doc (`Salesforce dashboard->Setup->Company Profile->Company Information->Salesforce.com Organization Id`).

**Note**: If you want to access salesforce metadata without token(only by using organization id), you will need to setup your ip in trusted ip ranges. You can go (`Salesforce dashboard->Setup->Security->Network Access->Trusted IP Ranges`) to configure this. You can check <a href="https://help.salesforce.com/s/articleView?id=sf.security_networkaccess.htm&type=5" target="_blank">here</a> to configure your ip in trusted ip ranges.
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

Follow the steps mentioned <a href="https://help.salesforce.com/s/articleView?id=000386929&type=1" target="_blank">here</a> to get the API version.
Enter the numerical value in the field, For example `42.0`.

$$

$$section
### Salesforce Domain $(id="salesforceDomain")

When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

$$


$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation to connect to Salesforce.
$$

$$section
### SSL Certificate $(id="sslCertificate")
Provide the path to SSL client certificate file (`ssl_cert`)
$$

$$section
### SSL Key $(id="sslKey")
Provide the path to SSL key file (`ssl_key`)
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
