---
title: Run DeltaLake Connector using the CLI
slug: /openmetadata/connectors/database/deltalake/cli
---

<ConnectorIntro connector="DeltaLake" goal="CLI" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="DeltaLake" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **Metastore Host Port**: Enter the Host & Port of Hive Metastore to configure the Spark Session. Either
  of `metastoreHostPort` or `metastoreFilePath` is required.
- **Metastore File Path**: Enter the file path to local Metastore in case Spark cluster is running locally. Either
  of `metastoreHostPort` or `metastoreFilePath` is required.
- **appName (Optional)**: Enter the app name of spark session.
- **Connection Arguments (Optional)**: Key-Value pairs that will be used to pass extra `config` elements to the Spark
  Session builder.

We are internally running with `pyspark` 3.X and `delta-lake` 2.0.0. This means that we need to consider Spark
configuration options for 3.X.

- You can find all supported configurations [here](https://spark.apache.org/docs/latest/configuration.html)
- If you need further information regarding the Hive metastore, you can find
  it [here](https://spark.apache.org/docs/3.0.0-preview/sql-data-sources-hive-tables.html), and in The Internals of
  Spark SQL [book](https://jaceklaskowski.gitbooks.io/mastering-spark-sql/content/spark-sql-hive-metastore.html).

<MetadataIngestionConfig service="database" connector="DeltaLake" goal="CLI" hasDBT="true"/>
