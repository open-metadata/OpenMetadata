# Metadata

Storage Service Metadata Pipeline Configuration.

## Configuration

$$section

### Container Filter Pattern $(id="containerFilterPattern")

Container filter patterns are used to control whether to include Containers as part of metadata ingestion.

**Include**: Explicitly include Containers by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Containers with names matching one or more of the supplied regular expressions. All other Containers will be excluded.

For example, to include only those Containers whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Containers by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Containers with names matching one or more of the supplied regular expressions. All other Containers will be included.

For example, to exclude all Containers with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern" target="_blank">this</a> document for further examples on filter patterns.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Default Manifest $(id="defaultManifest")

Fallback manifest applied to any bucket that does not have its own `openmetadata.json` file. Useful when you want an administrator to seed an initial manifest from the pipeline config while still letting bucket owners self-serve by uploading their own manifest file later.

**Precedence** (highest to lowest):

1. The bucket's own `openmetadata.json` manifest file.
2. `defaultManifest` from this pipeline config.
3. The legacy global `storageMetadataConfigSource` (if configured).

The `defaultManifest` uses the same schema as a bucket manifest file, so the same JSON works whether pasted here or uploaded to a bucket. Each entry accepts either a literal `dataPath` or a glob-style pattern — use `*` for a single path segment, `**` for any depth, and `?` for a single character.

**Example**:

```json
{
  "entries": [
    {
      "containerName": "analytics-prod",
      "dataPath": "data/*/events/*.parquet",
      "structureFormat": "parquet",
      "autoPartitionDetection": true
    },
    {
      "containerName": "analytics-prod",
      "dataPath": "logs/**/*.json",
      "structureFormat": "json"
    }
  ]
}
```
$$

$$section
### Override Metadata $(id="overrideMetadata")

Set the `Override Metadata` toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source.

If the toggle is `enabled`, the metadata fetched from the source will override and replace the existing metadata in the OpenMetadata.

If the toggle is `disabled`, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. In this case the metadata will only get updated for fields that has no value added in OpenMetadata.

This is applicable for fields like description, tags, owner and displayName

$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$