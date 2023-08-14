# Couchbase
In this section, we provide guides and references to use the Couchbase connector. You can view the full documentation for Couchbase [here](https://docs.open-metadata.org/connectors/database/couchbase).

## Requirements
To extract metadata, the user used in the connection needs to be able to perform `find` operation on collection and `listCollection` operations on database available in Couchbase.

You can find further information on the Hive connector in the [here](https://docs.open-metadata.org/connectors/database/couchbase).

## Connection Details

$$section
### Couchbase Connection Details $(id="connectionDetails")

Choose between Couchbase Connection Values to authenticate with your Couchbase cluster.
$$

$$section
### Username $(id="username")
Username to connect to Couchbase. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in Couchbase.
$$

$$section
### Password $(id="password")
Password to connect to Couchbase.
$$

$$section
### Host Name $(id="endpoint")

This parameter specifies the hostname/ endpoint of your client connection of the Couchbase instance. 

$$section
### Bucket Name $(id="bucket")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Bucket > Schema > Table
```
In the case of Couchbase, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field. Otherwise by default it will ingest all availabe buckets.
$$


