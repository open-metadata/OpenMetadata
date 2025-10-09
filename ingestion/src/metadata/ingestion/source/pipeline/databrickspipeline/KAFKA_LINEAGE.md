# Databricks Pipeline Kafka Lineage Integration

This document explains how the Databricks Pipeline connector extracts Kafka topic lineage from DLT (Delta Live Tables) pipelines.

## Overview

The connector automatically discovers Kafka topics consumed by DLT pipelines by:
1. Fetching DLT pipeline configuration from Databricks Pipelines API
2. Extracting notebook/file paths from pipeline libraries
3. Exporting source code from Databricks Workspace
4. Parsing Kafka configurations from the code
5. Creating lineage between Kafka topics and DLT pipelines in OpenMetadata

## Configuration

### Prerequisites

1. **Databricks Permissions**: The service account needs:
   - Access to Jobs API (`GET /api/2.1/jobs/*`)
   - Access to Pipelines API (`GET /api/2.0/pipelines/*`)
   - Access to Workspace API (`GET /api/2.0/workspace/export`)

2. **OpenMetadata Setup**:
   - Kafka topics must be ingested into OpenMetadata first
   - Configure `messagingServiceNames` to specify which Kafka services to search

### Configuration Example

```yaml
source:
  type: databricksPipeline
  serviceName: databricks_pipeline_service
  serviceConnection:
    config:
      type: DatabricksPipeline
      hostPort: https://your-workspace.cloud.databricks.com
      token: <your-databricks-token>
  sourceConfig:
    config:
      type: PipelineMetadata
      # Enable Kafka lineage extraction
      includeKafkaLineage: true
      # Specify Kafka/messaging services to search for topics
      messagingServiceNames:
        - kafka_production
        - kafka_staging
      # Optionally specify database services for table lineage
      dbServiceNames:
        - databricks_unity_catalog
```

## How It Works

### 1. Pipeline Detection

The connector identifies DLT pipelines by looking for `pipeline_task` in the job configuration:

```python
{
  "job_id": 123,
  "settings": {
    "tasks": [{
      "pipeline_task": {
        "pipeline_id": "abc-def-123"
      }
    }]
  }
}
```

### 2. Source Code Extraction

For each pipeline, the connector:
- Calls `/api/2.0/pipelines/{pipeline_id}` to get configuration
- Extracts library paths (notebooks/files)
- Calls `/api/2.0/workspace/export` to get source code

### 3. Kafka Configuration Parsing

The parser extracts Kafka configurations from patterns like:

```python
# Python/PySpark
spark.readStream \
  .format("kafka") \
  .option("kafka.bootstrap.servers", "broker:9092") \
  .option("subscribe", "topic1,topic2") \
  .option("groupIdPrefix", "dlt-pipeline") \
  .load()
```

```sql
-- SQL
CREATE OR REFRESH STREAMING TABLE bronze
AS SELECT * FROM read_kafka(
  bootstrapServers => 'broker:9092',
  subscribe => 'events_topic'
)
```

### 4. Lineage Creation

For each discovered Kafka topic:
1. Search for the topic in configured messaging services
2. If found, create lineage edge: `Kafka Topic → DLT Pipeline`
3. Include pipeline reference in lineage details

## Supported Kafka Options

The parser recognizes these Kafka configuration options:

| Option | Description | Example |
|--------|-------------|---------|
| `kafka.bootstrap.servers` | Kafka brokers | `"broker1:9092,broker2:9092"` |
| `subscribe` | Topic names (comma-separated) | `"topic1,topic2"` |
| `topics` | Alternative to subscribe | `"events"` |
| `groupIdPrefix` | Consumer group prefix | `"dlt-pipeline"` |

## Troubleshooting

### No Kafka Lineage Created

**Issue**: Kafka topics not appearing in lineage

**Checks**:
1. Verify `includeKafkaLineage: true` in configuration
2. Ensure Kafka topics are ingested in OpenMetadata
3. Check `messagingServiceNames` includes the correct Kafka service
4. Review logs for parsing errors:
   ```
   DEBUG: Found 0 Kafka sources in /path/to/notebook
   ```

### Pipeline Not Detected

**Issue**: DLT pipeline not being processed

**Checks**:
1. Verify job has a `pipeline_task` (not just `notebook_task`)
2. Check Pipelines API permissions
3. Review logs:
   ```
   DEBUG: No DLT pipeline task found for job <id>
   ```

### Source Code Not Accessible

**Issue**: Cannot export notebook source

**Checks**:
1. Verify Workspace API permissions
2. Check notebook path is correct
3. Ensure notebook exists and is accessible
4. Review logs:
   ```
   WARNING: Failed to export notebook /path: 403
   ```

### Topics Not Found

**Issue**: Topics extracted but lineage not created

**Checks**:
1. Verify topic names match exactly (case-sensitive)
2. Ensure topics are ingested in the specified messaging services
3. Check FQN format: `<service>.<topic_name>`
4. Review logs:
   ```
   DEBUG: Kafka topic events_topic not found in messaging service kafka_prod
   ```

## Example Lineage Flow

Complete flow from Kafka to Unity Catalog tables:

```
Kafka Topic (events)
       ↓
DLT Pipeline (bronze_ingestion)
       ↓
Unity Catalog Table (catalog.bronze.events)
       ↓
DLT Pipeline (silver_transformation)
       ↓
Unity Catalog Table (catalog.silver.events_clean)
```

The connector creates:
1. **Kafka → Pipeline** lineage (from code parsing)
2. **Pipeline → Table** lineage (from system.access.table_lineage)
3. **Table → Pipeline → Table** lineage (from system.access tables)

## Limitations

1. **Code Parsing**: Only extracts from `.format("kafka")` patterns
   - Custom Kafka readers may not be detected
   - Dynamic topic names (from variables) not supported

2. **API Access**: Requires permissions to:
   - Read pipeline configurations
   - Export workspace notebooks
   - Access job details

3. **Matching**: Topics must exist in OpenMetadata before lineage creation
   - Run Kafka connector first
   - Configure correct messaging service names

4. **DLT Only**: Works for DLT pipelines, not standard Spark jobs
   - Requires `pipeline_task` in job configuration
   - Not compatible with direct notebook execution

## Future Enhancements

Potential improvements:
- Support for Kinesis, Event Hubs, and other streaming sources
- Dynamic topic name resolution using configuration values
- Support for read_kafka SQL function
- Extraction from Spark configurations (spark_conf)
- Support for pipeline parameters and widgets
