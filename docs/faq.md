# FAQ

## Generic Questions&#x20;

#### How do I upgrade OpenMetadata?&#x20;

Please follow the instructions to [Upgrade OpenMetadata](broken-reference) and. You might also want to review,  [Backup OpenMetadata.](install/backup-metadata.md)

#### How do I explore OpenMetadata using a local deployment?

Please follow these instructions to [Run OpenMetadata](https://docs.open-metadata.org/install/run-openmetadata).

#### Ingestion to OpenMetadata can be done via API through the POST method, right?

Yes, we have PUT, POST, PATCH to ingest (create/update). Please use the [sandbox](https://docs.open-metadata.org/install/run-openmetadata) to test out the APIs. You may also experiment with the APIs directly in the [API documentation](https://sandbox.open-metadata.org/docs).&#x20;

#### Is fullyQualifiedName unique across all the entities or within its own data entity type?&#x20;

A `fullyQualifiedName` is formed by `service_name.{database_name}.{table_name}` or by `service_name.{dashboard_name}`, as the case may be. The `fullyQualifiedName` is unique across all your metadata across the services. We are using the unique identity of the dashboard and not the title for `dashboard_name`. That's why we have both the Name as well as displayName. The displayName comes from the actual title or the name of the object. In the case of tables, the name cannot be changed once it is created, but for pipelines or dashboards the name can be changed post creation. displayName can be changed anytime using PUT or patch.

#### Where can I better understand what the code does?

Please refer to the [Quick Start Guide for Developers](open-source-community/developer/quick-start-guide.md).

#### Is there a cloud hosted OpenMetadata solution?&#x20;

We do support OpenMetadata on Kubernetes that can be hosted on any cloud service. Please refer to [Run in Kubernetes](https://docs.open-metadata.org/install/run-in-kubernetes).

We are actively working on a SaaS solution and will make it available soon. If you are interested, please connect with us via our [Slack community](https://slack.open-metadata.org).

#### How do I delete sample data?

To delete all sample data from your OpenMetadata deployment, navigate to the root directory of either a binary or source distribution of OpenMetadata and run the following command.

```
./bootstrap/bootstrap-storage.sh drop-create
```

#### I am getting a 404 error at localhost:8585

If you followed the instructions in the [Build Code & Run Tests](open-source-community/developer/build-code-run-tests.md) guide and are running OpenMetadata from _Intellij_, `-cp to openmetadata-dist`.

#### Are there any CPU and memory requirements to run OpenMetadata in production?

It's best to have an 8GB JVM to run OpenMetadata. If you are configuring multiple instances of OpenMetadata for deployment in a Kubernetes environment, you should configure 8-16 cores for each pod.

#### What is architecture of OpenMetadata?

Please refer to the [Solution Design](open-source-community/developer/solution-design.md) to understand about the architecture and the interactions between the components.

## Airflow

#### Should I only use the build-in Airflow integration for ingestion?

OpenMetadata gives you maximum flexibility. You can also use our Python ingestion framework without Airflow or with a different Airflow deployment.&#x20;

## API

#### What fields are supported to update PUT in the REST API?

PUT is specifically made for ingestion. For example, if there is a table comment in the source system. When we are creating the table entity we add this as a description for the first time, if the description doesn’t exist. If a user updates this description on the UI, we do not overwrite the description when the ingestion runs the next time. Preference is given to user provided information. One can use patch APIs to overwrite all this. UI uses patch APIs.

## AWS&#x20;

#### How do I deploy OpenMetadata in an AWS EC2 instance?&#x20;

We have Helm charts to deploy on AWS. If you have a Kubernetes cluster, follow the [Run in Kubernetes guide](install/run-in-kubernetes.md).&#x20;

You can set up Docker ce and install OpenMetadata via docker-compose or install it as a standalone instance on EC2. If you want to run OpenMetadata on EC2, follow the [Run in Production](install/run-in-production.md) guide. The minimum requirement is 2 GiB RAM.

## Connectors

#### Why do I see ERROR: No matching distribution found for openmetadata-ingestion?

If you receive the following errors when installing connectors:&#x20;

```
ERROR: Could not find a version that satisfies the requirement openmetadata-ingestion....
ERROR: No matching distribution found for openmetadata-ingestion...
```

Please ensure that your Python version is 3.8.0 or above.

#### Is it easy to fetch metadata from other metadata systems into OpenMetadata?

We have support using JDBC to fetch metadata. OpenMetadata includes well-designed schemas and well-defined APIs. The OpenMetadata ingestion framework also enables rapid development of a connector for any data store. The OpenMetadata team is happy to help build one for your use case.

#### How do I ensure that metadata is ingested into OpenMetadata regularly?

Please configure an ingestion workflow to run periodically. You can also use Apache Airflow. Another option is to use a cron job.

#### What commands do I use to ingest data?

Visit the documentation for [connectors](faq.md#connectors) and select the guide for service you would like to ingest data from. Follow the instructions for installing, configuring, and running ingestion from the command line for the relevant connector.

### BigQuery

#### Are columns of the type array supported for BigQuery?

Yes, they are supported. Ensure that you are using the latest Python lib.

#### Is there a limit to the number of BigQuery tables we can ingest in one run?

There are no limits as such. In case you are stuck with the ingestion, check if there is an issue where the table has a nested record and is running into issues in parsing. Or if parsing for column types is getting stuck.

### Glue

#### Is there any way to sync all Glue databases or I need to create an ingestion for each one?&#x20;

You should be able to get all the Glue databases in one go.

### Hive

#### With respect to the Hive and Kafka connectors, does OpenMetadata pull incrementally or pull all the data, all the time?

Currently, it pulls all the time. We are working on making a Hive metastore plugin to get metadata when the DDL commands come in. Since it is mostly metadata, the payload is not that heavy to pull in.

### MSSQL

#### Why does create database using the API for service type MSSQL fail with invalid service type?

Ensure that you only change the service\_name and not the service\_type in your workflow config "host\_port": "192.168.1.32:1433", "service\_name": "local\_mssql", "service\_type": "MSSQL", "Database":"model",

### MySQL

#### How does metadata ingestion work, especially in relation to the code flow for MySQL ingestion?&#x20;

Please refer to the [Build a Connector](open-source-community/developer/build-a-connector/) guide for details on building a connector for OpenMetadata.

### Oracle

#### Can we catalog multiple MySQL/Oracle instances using one JSON file?

Yes, you can catalog multiple instances by adding sources and their properties into a single configuration file. Add one source to the file for each service. For e.g., for Oracle and MySQL, one source of Oracle and one source of MySQL will work. A default sink can be added, i.e. metadata-rest.

#### If one has two Oracle services, how can we apply a filter so as to search only in the desired Oracle service?

The use of `service_name` helps distinguish between databases or warehouses that you fetch data from. We can find the desired instance by using the fully qualified name. E.g., `oracle_dev.db_name.table_name`

### Redshift

#### Why do we receive an out of memory error while running an ingestion DAG for a Redshift service on an EC2 instance?&#x20;

Please try increasing the workflow timeout to resolve the issue. This could also be due to the sample query which takes a longer time if you have a big table. Please try disabling sample data by setting `generate_sample_data` to `"false"` in your configuration file.

## Data Quality - Profiler

#### How does the profiler calculate distinct, null ratio, and other statistics?&#x20;

The profiler runs SQL queries for tables to calculate the null ratio, min, max, avg, etc.

#### How frequently are the data quality parameters refreshed?

For now, the profiler runs as part of the metadata collection. We are going to separate this out and allow users to schedule profiler workflows separately at a different frequency than the metadata collection. Currently, frequency is set based on your metadata ingestion frequency and can be configured to suit your needs.

#### Does the profiler slow down metadata ingestion?

It can cause slowness depending on your deployment. For example, if you have Hive, then you can create a queue and pass that info to the profiler to set priorities on the queue. Users can schedule the profiler at non-peak hours. Also, if you have date partitioned tables you can take the profile of the table incrementally, like every day such that it only reads the single day's partition rather than the entire table.

#### Why do I see the following error when attempting metadata ingestion?

```
ERROR: Command errored out with exit status 1
```

This is likely caused because you have not installed the data-profiler extra in addition to your connector. Please run the following command to correct the problem.

```
pip3 install 'openmetadata-ingestion[data-profiler]'
```

#### How are the frequently joined tables data generated?

We have usage connectors for Redshift, BigQuery and Snowflake, which are the databases supported via usage. We do a generic query processing using a [query log](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/examples/sample\_data/datasets/query\_log). Snowflake,Redshift, and BigQuery provide this query log as part of their audit tables which makes it easier to write a connector and generate those. However, the query logging can be turned on in [MySQL](https://stackoverflow.com/questions/6479107/how-to-enable-mysql-query-log).

## Database Services

#### Why is the Service Type required along with the Service ID when creating a database?

We need the _Service Type_ details during metadata ingestion. For example, if the UUID points to a BigQuery service, but the database being created is Redshift, then we need to know the _Service Type_ being used.&#x20;

A database service is a collection of databases. A database is a collection of tables. A database cannot be created without a database service. Similarly, a table cannot be created without a database. So when you create a database, you must provide what database service it belongs to; and also when you create a table, you must provide what database it belongs to.&#x20;

All OpenMetadata APIs have the entity type and ID to identify an entity. All entities have their own separate namespace in which the ID is valid. Each entity type is stored in a separate table instead of a single global entity table, so that it is scalable.&#x20;

## Docker

#### Why do I receive an error when I try to start OpenMetadata in Mac OS using Docker?&#x20;

Please check to ensure your system meets the Docker resource requirements specified in the [Run OpenMetadata](install/run-openmetadata.md) guide.

## Elasticsearch

#### After installing OpenMetadata with MySQL and Elasticsearch in a production environment, there were problems reaching Elasticsearch with OpenMetadata.

Run the following command from the same system where you are running OpenMetadata.

```
curl -X GET http://<ip address to Elasticsearch instance>:9200
```

Please ensure that the IP address and port for your Elasticsearch instance are accessible from the OpenMetadata instance.

#### How do I manually run Elasticsearch ingestion to index newly added entities ingested from a data service?

Copy the following template to a configuration file named `metadata_to_es.json` or use an existing `metadata_to_es.json` file from the last time you installed or updated OpenMetadata.

```json
{
  "source": {
    "type": "metadata",
    "config": {
      "include_tables": "true",
      "include_topics": "true",
      "include_dashboards": "true",
      "limit_records": 10
    }
  },
  "sink": {
    "type": "elasticsearch",
    "config": {
      "index_tables": "true",
      "index_topics": "true",
      "index_dashboards": "true",
      "es_host": "localhost",
      "es_port": 9200
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
```

Run the following command from the root directory of your clone of the OpenMetadata GitHub repository.

```
metadata ingest -c pipelines/metadata_to_es.json
```

## Entities

#### Is there a way to create custom entities? Can we tune the current definition of the existing entities?&#x20;

Yes. You can customize entities using [JsonSchema](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema). Refer to [#643](https://github.com/open-metadata/OpenMetadata/discussions/643) for instructions and an example.

#### What are the steps to create a new data asset type and integrate it into OpenMetadata?

To register a new entity, you'll need to do the following on the backend:&#x20;

* Add schema&#x20;
* Code for repository
* Code for resource

Follow the guide to [Build the code & run tests](open-source-community/developer/build-code-run-tests.md).

#### Custom entities like metrics can be added. Are metric definitions supported as first class citizens?&#x20;

We have a placeholder for metrics. OpenMetadata's goal is to standardize the entities and schemas. So if there’s a requirement to add custom entities, we’d love to discuss further and add it to OpenMetadata itself. Please connect with us via our [Slack community](https://slack.open-metadata.org).

#### In the OpenMetadata backend, in entity\_relationship, there is a column ‘relation’ which contains numbers such as 0,13,8. What does this relation number indicate?

Please see [Relationship.java](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/java/org/openmetadata/catalog/jdbi3/Relationship.java#L32).

#### Which entities are for data quality integration?

Quality is an attribute of an entity and not an entity unto itself. For example, the table has descriptions. One could compile the quality of description and store it as metadata of the table. Table has freshness, completeness, and SLAs. Quality of these are measured and they become additional metadata of an existing table.

## Kafka

#### Does OpenMetadata support JSON Schema for Kafka?

Yes.

#### Does OpenMetadata authenticate to Kafka using SSL?

Yes. OpenMetadata uses Confluent Kafka admin libs, which supports SSL.

#### Does OpenMetadata support Kafka topic lineages?

OpenMetadata supports lineage between all entities and we have an API that will allow you to connect these entities together. Currently, OpenMetadata supports lineage extraction from few data sources and airflow by analyzing the query logs. It is tricky to extract the lineage from Kafka itself as it means going through the source code of producers and consumers. Here’s an [example](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/airflow\_provider\_openmetadata/lineage/openmetadata.py#L201) to PUT lineage directly via Python API.

Everything in OpenMetadata can be referenced through the [EntityReference](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityReference.json), which is like a pointer to any entity like table, topic, pipeline, dashboard etc.&#x20;

```
lineage = AddLineage(
  edge=EntitiesEdge(
    fromEntity=EntityReference(id=table_entity.id, type="table"),
    toEntity=EntityReference(id=pipeline.id, type="pipeline"),
  )
)
```

If you want to connect two topics: when you ingest topic data into OpenMetadata it assigns a UUID for that entity and an entity reference can be as simple as assigning that UUID. Once you have this topic ingested, you can use the following code to generate lineage.

```
lineage = AddLineage(
  edge=EntitiesEdge(
    fromEntity=EntityReference(id=topic_entity.id, type="topic"),
    toEntity=EntityReference(id=topic_entity.id, type="topic"),
  )
)
```

That's a single record of the lineage. The process is as follows:

* Ingest your topic data into OpenMetadata
* Get the entity reference of a topic using its name "service\_name.topic\_name"
* Generate the lineage as shown above
* Pass this lineage record downstream
* Use metadata\_sink rest like rest of the connectors do

This will [publish the lineage](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata\_rest.py#L367) to OpenMetadata.

## Kubernetes

#### Why do I receive the error, "airflowConfiguration must not be null", when deploying OpenMetadata on a Kubernetes cluster?

```
"migrate" option successful
io.dropwizard.configuration.ConfigurationValidationException: conf/openmetadata.yaml has an error:
* airflowConfiguration must not be null
```

To fix this problem, [add the airflowConfiguration section](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata.yaml#L124). This is required to deploy via UI. It can be filled in without credentials (Admin credentials are not required). AirflowConfiguration is required to use the wizard.

## Lineage

#### Can we ingest lineage, ownership through OpenMetadata APIs?

Lineage APIs are available. You can use your own way of capturing the [lineage info](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/sink/metadata\_rest.py#L367) and publish it. Here is the [schemaDefinition](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/entityLineage.json).

#### Are there any step by step instructions for installation using docker-compose to use OpenMetadata to integrate with Apache Airflow for data lineage?

Please follow the instructions to [Configure Airflow Lineage](https://docs.open-metadata.org/install/metadata-ingestion/airflow/configure-airflow-lineage). Once you've configured the backend, you'll need to [manually tag the pipelines](https://github.com/open-metadata/OpenMetadata/blob/0.7.0/ingestion/examples/airflow\_lineage/openmetadata\_airflow\_lineage\_example.py) with inlets and outlets.

#### How does the Data Lineage work? Do I have to introduce my queries to OpenMetadata, or will it read my stored procedures/views from DB and generate the data lineage based on that?&#x20;

OpenMetadata has integrations into Airflow to capture the lineage and publish it to OpenMetadata. We can also run query log processors to analyze the queries in your data source to extract lineage. This is work in progress. We are adding support for Superset and Looker, from where we see which queries are being used for dashboards to extract the lineage. If you are using DBT, we also link the DBT Models to tables.

#### Why am I unable to put Airflow lineage in OpenMetadata?

OpenMetadata collects the Airflow lineage through inlets and outlets. We need the FQDN of the entities to be listed - `{service_name}.{database}.{table}` Please check your task log to see if the OpenMetadata service can be reached from your Airflow.

#### How do I update Airflow lineage?

Airflow lineage gets updated every time the DAG runs.

#### For which sources does OpenMetadata automatically build lineage?

OpenMetadata currently supports adding lineages from pipelines, dashboards, and tables via UI and Airflow. Please refer to the Data Lineage section to know more about setting upstream and downstream lineage manually from UI.

## Maven and Java Versions

#### After the flyway migration completes, all tests are failing with the error `NoClassDefFoundError`. Why?

The issue is with Java 17. Try using Maven 3.5.4 or 3.8.2 with Java 11.

## Models and Features

#### Does OpenMetadata support model and features catalogs as well?

OpenMetadata support MLModels. Please check here for [MLFLow support](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/source/mlflow.py). OpenMetadata has APIs to support the [MLModel](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/mlmodel.json) entity. You can ingest the metadata from your own custom service using our framework.

#### How do I ingest from DBT?

We support DBT models for different [connectors](https://docs.open-metadata.org/connectors). Configuring DBT inside [config](https://docs.open-metadata.org/connectors/mysql#9.-configure-dbt-optional) by adding “dbt\_manifest\_file” and “dbt\_catalog\_file” will allow the user to ingest dbt models.

#### What information does OpenMetadata store for ML Model?

Regarding the attributes of the Entity, we are trying to see the ML work from a Data Platform perspective. Tools such as MLFlow capture the ML process metadata from an experimentation perspective, and when talking about hosting and serving the model, that is still seen in isolation. In this representation from the MLModel, we are then trying to give information such as:

* Model algorithm
* Dashboard where we can see the performance metrics evolution
* MLFeatures: inputs to train the model
* MLStore where the model info can be found (e.g. S3 or a docker image)
* Server: URI where we serve the model
* MLHyperParameters

#### Are MLFeatures like the fields of a table or can they be as a table as well?

MLFeatures can have extended properties to have them linked to their sources MlFeatureSource. For example, a feature called “Profile” can be a PCA analysis on top of multiple columns of a couple of tables. The MlFeatureSource is the property that led us to link through lineage the MLModel to a specific table.

We made a division between MLFeature and MLSource, as usually MLFeatures have specific algorithms, aggregations or processing that can be quite specific and not always linked to a single table source. This way we can achieve an end-to-end definition on what sources are being used and how. We are currently working so that if you specify an EntityReference in a MlFeatureSource, then the lineage will be created automatically. For more information, please refer to the [ML Model Entity](https://docs.open-metadata.org/open-source-community/developer/entities/ml-model-entity).

## Policy

#### Where can I find information on Policy entities?

Please refer to the [Policy Schema](https://docs.open-metadata.org/openmetadata/schemas/entities/policy) and [Policy API](https://sandbox.open-metadata.org/docs#tag/policies).

## Query

#### Will it be possible to query the metadata store using graph-like queries (Cypher)?

Access to the metadata store is through APIs only. This ensures that applications don’t depend on internal implementation details.

## Sample Data

#### Can I tweak the ingestor config file to enable/disable or increase/decrease the sample data size?&#x20;

You can use the following query parameter to override the changes in sample data:

```
select * from {}.{} where ROWNUM <= 50
```

In order to disable sample data, send the following in config. By default, generating sample data is set to "true".

```
"generate_sample_data": "false"
```

## Schema

#### What is the approach for triggering and updating Python codegen of schemas?

Use the following command.

```bash
datamodel-codegen --input ../catalog-rest-service/src/main/resources/json --input-file-type jsonschema --output src/metadata/generated

```

The above command will generate the Python related models according to the latest changes under JSON Schema

#### Why are Schemas named using the term "Database" in the OpenMetadata UI?

We use "schema" and "database" interchangeably. Some database services have databases the same as schema with database/schema -> tables hierarchy. Some have additional hierarchy with database -> schema -> tables.

## Search

#### How does OpenMetadata increase search relevance?

OpenMetadata has a search autocomplete feature backed by /v1/search/suggest API over all Elasticsearch indexes. Also, full search/filter search is supported by /v1/search/query API. In order to increase search relevancy, OpenMetadata gives Name, Descriptions, and a higher weight followed by column names, and descriptions. The search relevancy can be extended by having an offline process to collect the user search terms and what they click on the page and add weight to those.

## Storage

#### Where does OpenMetadata store the MySQL database metadata?

Please check the details on the configured database and user details. Under the db, there’ll be a table\_entity

#### Is retention information added, so that a user looking at a table knows how long the table should be retained?&#x20;

A retention policy can be associated with a table.

## Tags

#### What’s the difference between the tag `personalDataTags` and `piiTags`?

PII and personal data are requirements from diff regulations (mostly US vs EU) and have different definitions. Please refer to [TechGDPR](https://techgdpr.com/blog/difference-between-pii-and-personal-data/).

#### At what levels are tags supported?

Tags are supported for tables and columns; dashboards and charts; topics, and pipelines.

## Usage

#### How is usage calculated for each entity?

Usage is based on the query log analysis. For now, we have support for Redshift, Snowflake, BigQuery as it is easy to retrieve their query logs. We can extend this to other databases as well.&#x20;

## User Access

#### Is there any permission control to access OpenMetadata?&#x20;

Yes. OpenMetadata supports several [security options](install/enable-security/) and provides [Role Based Access Control](https://docs.open-metadata.org/features#role-based-access-control).

OpenMetadata has a simple, pluggable authorizer once you enable security. If you already have a centralized policy store, we can integrate into it.

#### How do I add an admin user, viewer, and editor.

You can add [adminPrincipals](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata-security.yaml#L120) like in this config. You can pass an array for adminPrincipals. These are bootstrapped admins. The name should match the username in the email. Do not add the email ID, but just the username part of the email. Once you have one or two bootstrapped admins, you can go to the users page and click on any user to make them an Admin.

See also, [Role Based Access Control](https://docs.open-metadata.org/features#role-based-access-control)

#### What permissions do adminPrincipals have?

Admin users have site-wide permissions. Regular users can be the owners of datasets or other entities. If they are the owners, they get full access to the entities they own. Teams can own entities as well. So any one in the team can have access to those entities to edit, etc. Other users can suggest description changes, tags, etc.

#### What are the restrictions for a non-admin user?

* If a dataset or table does not have any owners, anybody can update the comments or descriptions, tags, etc.
* If a dataset has a team ownership, only members of that team can update the description.
* If a dataset has an individual ownership, only that user can update the entity descriptions.&#x20;
* Admin or bot users have site-wide privileges and can do updates across the system.

See also, [Role Based Access Control](https://docs.open-metadata.org/features#role-based-access-control)

#### Can a non-admin user create services and ingestions?&#x20;

No, only admins can create services and ingestions.

#### How can I convert my user access to be able to edit in the OpenMetadata sandbox?

Currently, I can only view information. Let us know your username and we can add you to one of the teams, so that you can get edit privileges on data assets. Alternatively, use another Gmail address and login to the Sandbox. When you are signing up, under Select teams choose yourself as a member of all the teams. Once you login, you will get write operations for all the datasets that are in the My Data tab in the initial page.
