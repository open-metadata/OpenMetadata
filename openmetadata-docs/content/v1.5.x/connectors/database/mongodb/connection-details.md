---
title: Connection Details
slug: /connectors/database/mongodb/connections
---

#### Connection Details

- **Username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.
- **Password**: Password to connect to MongoDB.
- **Host Port**: When using the `mongodb` connecion schema, the hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`. When using the `mongodb+srv` connection schema, the hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname`. E.g., `cluster0-abcde.mongodb.net`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

Using Atlas? Follow [this guide](https://www.mongodb.com/docs/guides/atlas/connection-string/) to get the connection string.

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}