## Query Usage

The Query Usage workflow will be using the `query-parser` processor.

After running a Metadata Ingestion workflow, we can run Query Usage workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for BigQuery Usage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=25 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.

{% /codeInfo %}

{% codeInfo srNumber=26 %}

**stageFileLocation**: Temporary file name to store the query logs before processing. Absolute file path required.

{% /codeInfo %}

{% codeInfo srNumber=27 %}

**resultLimit**: Configuration to set the limit for query logs

{% /codeInfo %}

{% codeInfo srNumber=28 %}

**queryLogFilePath**: Configuration to set the file path for query logs

{% /codeInfo %}


{% codeInfo srNumber=29 %}

#### Processor, Stage and Bulk Sink Configuration

To specify where the staging files will be located.

Note that the location is a directory that will be cleaned at the end of the ingestion.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: {% $connector %}-usage
  serviceName: {% $connector %}
  sourceConfig:
    config:
      type: DatabaseUsage
```
```yaml {% srNumber=25 %}
      # Number of days to look back
      queryLogDuration: 7
```

```yaml {% srNumber=26 %}
      # This is a directory that will be DELETED after the usage runs
      stageFileLocation: <path to store the stage file>
```

```yaml {% srNumber=27 %}
      # resultLimit: 1000
```

```yaml {% srNumber=28 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: path-to-file
```

```yaml {% srNumber=29 %}
processor:
  type: query-parser
  config: {}
stage:
  type: table-usage
  config:
    filename: /tmp/athena_usage
bulkSink:
  type: metadata-usage
  config:
    filename: /tmp/athena_usage
```

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}
{% /codePreview %}

### 2. Run with the CLI

After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```bash
metadata usage -c <path-to-yaml>
```