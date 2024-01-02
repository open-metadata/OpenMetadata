# Hive
In this section, we provide guides and references to use the MongoDB connector. You can view the full documentation for MongoDB [here](https://docs.open-metadata.org/connectors/database/mongo).

## Requirements
To extract metadata, the user used in the connection needs to be able to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

You can find further information on the Hive connector in the [here](https://docs.open-metadata.org/connectors/database/mongo).

## Connection Details

$$section
### MongoDB Connection Details $(id="connectionDetails")

Choose between MongoDB Connection String and MongoDB Connection Values to authenticate with your mongodb cluster.
$$

$$section
### Connection URI $(id="connectionURI")

MongoDB connection string is a concise string of parameters used to establish a connection between an OpenMetadata and a MongoDB database. For ex. `mongodb://username:password@mongodb0.example.com:27017`
$$

$$section
### Username $(id="username")
Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.
$$

$$section
### Password $(id="password")
Password to connect to MongoDB.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the MongoDB instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:27017`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:27017` as the value.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of MongoDB, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection. The connectionOptions parameter is specific to the connection method being used. For example, if you are using SSL encryption, you might set the connectionOptions parameter to {'ssl': 'true', 'sslTrustStore': '/path/to/truststore'}.
$$
