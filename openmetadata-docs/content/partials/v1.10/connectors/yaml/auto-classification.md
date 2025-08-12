## Auto Classification

The Auto Classification workflow will be using the `orm-profiler` processor.

After running a Metadata Ingestion workflow, we can run the Auto Classification workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for the Auto Classification Workflow:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceAutoClassificationPipeline.json).

{% codeInfo srNumber=14 %}

**storeSampleData**: Option to turn on/off storing sample data. If enabled, we will ingest sample data for each table.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**enableAutoClassification**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**confidence**: Set the Confidence value for which you want the column to be tagged as PII. Confidence value ranges from 0 to 100. A higher number will yield less false positives but more false negatives. A lower number will yield more false positives but less false negatives.

{% /codeInfo %}

{% codeInfo srNumber=19 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=20 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=22 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}


{% codeInfo srNumber=23 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: {% $connector %}
  serviceName: {% $connector %}
  sourceConfig:
    config:
      type: AutoClassification
```
```yaml {% srNumber=14 %}
      # storeSampleData: true
```
```yaml {% srNumber=15 %}
      # enableAutoClassification: true
```
```yaml {% srNumber=18 %}
      # confidence: 80
```
```yaml {% srNumber=19 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=20 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=21 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=22 %}
processor:
  type: orm-profiler
  config: {}
```

```yaml {% srNumber=23 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


### 2. Run with the CLI

After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```bash
metadata classify -c <path-to-yaml>
```

{% note %}

Now instead of running `ingest`, we are using the `classify` command to select the Auto Classification workflow.

{% /note %}
