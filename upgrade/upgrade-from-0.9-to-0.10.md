# Upgrade from 0.9 to 0.10

The 0.10.x release contains backward incompatible changes this guide will help you to migrate your metadata from 0.9 version to 0.10 version. Please ensure that you've taken a backup of metadata of your OpenMetadata instance **prior to upgrading to the 0.10 release**.

## Requirements

* Backup your metadata. The steps to backup metadata depending on the depending on the method of deployment are defined below:

{% tabs %}
{% tab title="Docker" %}
{% content-ref url="upgrade-on-bare-metal/backup-metadata.md" %}
[backup-metadata.md](upgrade-on-bare-metal/backup-metadata.md)
{% endcontent-ref %}
{% endtab %}

{% tab title="Kubernetes" %}
{% content-ref url="upgrade-on-kubernetes/backup-metadata.md" %}
[backup-metadata.md](upgrade-on-kubernetes/backup-metadata.md)
{% endcontent-ref %}
{% endtab %}

{% tab title="Bare Metal" %}
{% content-ref url="upgrade-on-docker/backup-metadata.md" %}
[backup-metadata.md](upgrade-on-docker/backup-metadata.md)
{% endcontent-ref %}
{% endtab %}
{% endtabs %}

* To migrate the metadata from 0.9 to 0.10 version you need to ingest all the connectors in 0.10 version with the same service name as done in 0.9 version. For example if you have ingested snowflake connector in 0.9 version with service name `Snowflake_Prod` then in 0.10 version you need to ingest the snowflake connector again with name `Snowflake_Prod`.

## Metadata Migration <a href="#requirements" id="requirements"></a>

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/metadata/openMetadataConnection.json) you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config:

```json
source:
  type: migrate
  serviceName: local_metadata
  serviceConnection:
    config:
      type: OpenMetadata
      hostPort: http://<hostport of 0.9.0 Openmetadata Server>/api
      authProvider: no-auth
      includeTables: true
      includeUsers: true
      includeTopics: true
      includePipelines: true
      includeTags: true
      includeGlossaryTerms: true
      includeMessagingServices: true
      includeDatabaseServices: true
      includePipelineServices: true
      enableVersionValidation: false
      limitRecords: 100000
  sourceConfig:
    config:
      enableDataProfiler: false
stage:
  type: migrate
  config:
    dirPath: <Directory Path to store data>
bulkSink:
  type: migrate
  config:
    dirPath: <Directory Path to store data>
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://<hostport of 0.10.x Openmetadata Server>/api
    authProvider: no-auth
```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/clickhouseConnection.json).

* hostPort: Enter the OpenMetadata 0.9 Server Config. Must include API end point ex: http://localhost:8585/api
* includeTables: Include tables for migration
* includeUsers: Include users for migration
* includeTopics: Include topics for migration
* includePipelines: Include pipelines for migration
* includeGlossaryTerms: include glossary terms for migration
* includeTags: Include tags for migration.
* includeMessagingServices: Include messaging services for migration.
* includeDatabaseServices: Include database services for migration.
* enableVersionValidation: Enable the server OpenMetadata and client OpenMetadata version validation. For migrating the metadata this has to be set to `false`
* limitRecords: Limit the number records that is fetched by 0.9 OpenMetadata API (1 to 1000000, default = 10).

#### Stage Configuration

```
stage:
  type: migrate
  config:
    dirPath: <Directory Path to store data>
```

The data while migrating form 0.9 to 0.10 version needs to be stored in a file directory. in the dirPath field enter a valid file directory path to store the metadata.&#x20;

#### BulkSink Configuration

```
bulkSink:
  type: migrate
  config:
    dirPath: <Directory Path to store data>
```

The dirPath needs to be set as the same passed in stage config, which contains the file directory path where the metadata is stored.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://<hostport of 0.10.x Openmetadata Server>/api
    authProvider: no-auth
```

Note: In openMetadataServerConfig you need to pass details about the 0.10 OpenMetadata Server.

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-yaml>
```
