# SAP ERP

In this section, we provide guides and references to use the SAP ERP connector.

## Requirements

You will need the following permissions to extract SAP ERP metadata:

- **API Access**: You must have the API Enabled permission in your SAP ERP instance.

## Connection Details

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the SAP ERP instance. This should be specified as a string in the format `https://hostname.com`.
$$

$$section
### Api Key $(id="apiKey")

Api Key to authenticate the SAP ERP Apis
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of SAP ERP, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of SAP ERP, we won't have a Database Schema as such. If you'd like to see your data in a database schema named something other than `default`, you can specify the name in this field.
$$

$$section
### Pagination Limit $(id="paginationLimit")

Pagination limit used while querying the SAP ERP API for fetching the entities.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
