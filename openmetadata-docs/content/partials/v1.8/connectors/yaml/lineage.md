## Lineage

After running a Metadata Ingestion workflow, we can run Lineage workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.

### 1. Define the YAML Config

This is a sample config for BigQuery Lineage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=40 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryLineagePipeline.json).

{% /codeInfo %}

{% codeInfo srNumber=41 %}

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process lineage data in days.

{% /codeInfo %}

{% codeInfo srNumber=42 %}

**parsingTimeoutLimit**: Configuration to set the timeout for parsing the query in seconds.
{% /codeInfo %}

{% codeInfo srNumber=43 %}

**filterCondition**: Condition to filter the query history.

{% /codeInfo %}

{% codeInfo srNumber=44 %}

**resultLimit**: Configuration to set the limit for query logs.

{% /codeInfo %}

{% codeInfo srNumber=45 %}

**queryLogFilePath**: Configuration to set the file path for query logs.

{% /codeInfo %}

{% codeInfo srNumber=46 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=47 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=48 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}


{% codeInfo srNumber=51 %}

**overrideViewLineage**: Set the 'Override View Lineage' toggle to control whether to override the existing view lineage.

{% /codeInfo %}


{% codeInfo srNumber=52 %}

**processViewLineage**: Set the 'Process View Lineage' toggle to control whether to process view lineage.

{% /codeInfo %}


{% codeInfo srNumber=53 %}

**processQueryLineage**: Set the 'Process Query Lineage' toggle to control whether to process query lineage.

{% /codeInfo %}


{% codeInfo srNumber=54 %}

**processStoredProcedureLineage**: Set the 'Process Stored ProcedureLog Lineage' toggle to control whether to process stored procedure lineage.

{% /codeInfo %}


{% codeInfo srNumber=55 %}

**threads**: Number of Threads to use in order to parallelize lineage ingestion.

{% /codeInfo %}


{% codeInfo srNumber=55 %}


#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=50 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% srNumber=40 %}
source:
  type: {% $connector %}-lineage
  serviceName: {% $connector %}
  sourceConfig:
    config:
      type: DatabaseLineage
```

```yaml {% srNumber=41 %}
      # Number of days to look back
      queryLogDuration: 1
```
```yaml {% srNumber=42 %}
      parsingTimeoutLimit: 300
```
```yaml {% srNumber=43 %}
      # filterCondition: query_text not ilike '--- metabase query %'
```
```yaml {% srNumber=44 %}
      resultLimit: 1000
```
```yaml {% srNumber=45 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: /tmp/query_log/file_path
```
```yaml {% srNumber=46 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=47 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=48 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=51 %}
      overrideViewLineage: false
```

```yaml {% srNumber=52 %}
      processViewLineage: true
```

```yaml {% srNumber=53 %}
      processQueryLineage: true
```

```yaml {% srNumber=54 %}
      processStoredProcedureLineage: true
```

```yaml {% srNumber=55 %}
      threads: 1
```

```yaml {% srNumber=49 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

- You can learn more about how to configure and run the Lineage Workflow to extract Lineage data from [here](/connectors/ingestion/workflows/lineage)

### 2. Run with the CLI

After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```bash
metadata ingest -c <path-to-yaml>
```