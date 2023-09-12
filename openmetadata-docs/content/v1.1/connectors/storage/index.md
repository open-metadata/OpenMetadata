---
title: Storage Services
slug: /connectors/storage
---

# Storage Services

This is the supported list of connectors for Storage Services:

- [S3](/connectors/storage/s3)

If you have a request for a new connector, don't hesitate to reach out in [Slack](https://slack.open-metadata.org/) or
open a [feature request](https://github.com/open-metadata/OpenMetadata/issues/new/choose) in our GitHub repo.

## Configuring the Ingestion

In any other connector, extracting metadata happens automatically. We have different ways to understand the information
in the sources and send that to OpenMetadata. However, what happens with generic sources such as S3 buckets, or ADLS containers?

In these systems we can have different types of information:
- Unstructured data, such as images or videos,
- Structured data in single and independent files (which can also be ingested with the [Data Lake connector](/connectors/database/datalake))
- Structured data in partitioned files, e.g., `my_table/year=2022/...parquet`, `my_table/year=2023/...parquet`, etc.

Then the question is, how do we know which data in each Container is relevant and which structure does it follow? In order to
optimize ingestion costs and make sure we are only bringing in useful metadata, the Storage Services ingestion process
follow this approach:

1. We list the top-level containers (e.g., S3 buckets), and bring generic insights, such as size and number of objects.
2. If there is an `openmetadata.json` manifest file present in the bucket root, we will ingest the informed paths
   as children of the top-level container. Let's see how that works.

{% note %}

Note that the current implementation brings each entry in the `openmetadata.json` as a child container of the
top-level container. Even if your data path is `s3://bucket/my/deep/table`, we will bring `bucket` as the top-level
container and `my/deep/table` as its child.

We are flattening this structure to simplify the navigation.

{% /note %}

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
            "structureFormat": "csv"
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
