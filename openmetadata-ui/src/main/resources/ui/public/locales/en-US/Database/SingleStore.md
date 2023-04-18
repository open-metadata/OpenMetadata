# SingleStore
In this section, we provide guides and references to use the MariaDB connector. You can view the full documentation for SingleStore [here](https://docs.open-metadata.org/connectors/database/singlestore).

# Requirements
You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/database/singlestore).

## Connection Details
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.

### Username $(id="username")
Username to connect to MariaDB. This user should have access to the `INFORMATION_SCHEMA` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.

### Password $(id="password")
Password to connect to SingleStore.

### Host Port $(id="hostPort")
Host and port of the SingleStore service.
**Example**: `localhost:3306`, `host.docker.internal:3306`

### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follow:
```
Database Service > Database > Schema > Table
```
In the case of SingleStore, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.

### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.

### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.

