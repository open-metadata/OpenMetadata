## OpenMetadata Manifest

Our manifest file is defined as a [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/storage/containerMetadataConfig.json),
and can look like this:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=1 %}

**Entries**: We need to add a list of `entries`. Each inner JSON structure will be ingested as a child container of the top-level
one. In this case, we will be ingesting 4 children.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**Simple Container**: The simplest container we can have would be structured, but without partitions. Note that we still
need to bring information about:

- **dataPath**: Where we can find the data. This should be a path relative to the top-level container.
- **structureFormat**: What is the format of the data we are going to find. This information will be used to read the data.
- **separator**: Optionally, for delimiter-separated formats such as CSV, you can specify the separator to use when reading the file.
  If you don't, we will use `,` for CSV and `/t` for TSV files.

After ingesting this container, we will bring in the schema of the data in the `dataPath`.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Partitioned Container**: We can ingest partitioned data without bringing in any further details.

By informing the `isPartitioned` field as `true`, we'll flag the container as `Partitioned`. We will be reading the
source files schemas', but won't add any other information.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**Single-Partition Container**: We can bring partition information by specifying the `partitionColumns`. Their definition
is based on the [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/data/table.json#L232)
definition for table columns. The minimum required information is the `name` and `dataType`.

When passing `partitionColumns`, these values will be added to the schema, on top of the inferred information from the files.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**Multiple-Partition Container**: We can add multiple columns as partitions.

Note how in the example we even bring our custom `displayName` for the column `dataTypeDisplay` for its type.

Again, this information will be added on top of the inferred schema from the data files.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="openmetadata.json" %}

```json {% srNumber=1 %}
{
    "entries": [
```
```json {% srNumber=2 %}
        {
            "dataPath": "transactions",
            "structureFormat": "csv",
            "separator": ","
        },
```
```json {% srNumber=3 %}
        {
            "dataPath": "cities",
            "structureFormat": "parquet",
            "isPartitioned": true
        },
```
```json {% srNumber=4 %}
        {
            "dataPath": "cities_multiple_simple",
            "structureFormat": "parquet",
            "isPartitioned": true,
            "partitionColumns": [
                {
                    "name": "State",
                    "dataType": "STRING"
                }
            ]
        },
```
```json {% srNumber=5 %}
        {
            "dataPath": "cities_multiple",
            "structureFormat": "parquet",
            "isPartitioned": true,
            "partitionColumns": [
                {
                    "name": "Year",
                    "displayName": "Year (Partition)",
                    "dataType": "DATE",
                    "dataTypeDisplay": "date (year)"
                },
                {
                    "name": "State",
                    "dataType": "STRING"
                }
            ]
        }
    ]
}
```

{% /codeBlock %}

{% /codePreview %}


### Global Manifest

You can also manage a **single** manifest file to centralize the ingestion process for any container. In that case,
you will need to add a `containerName` entry to the structure above. For example:

```yaml
{
  "entries": [
    {
      "dataPath": "transactions",
      "structureFormat": "csv",
      "isPartitioned": false,
      "containerName": "collate-demo-storage"
    }
  ]
}
```

You can also keep local manifests in each container, but if possible, we will always try to pick up the global manifest
during the ingestion.

We will look for a file named `openmetadata_storage_manifest.json`.
