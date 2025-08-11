---
title: Storage Services | OpenMetadataCloud Storage Guide
slug: /connectors/storage
---

# Storage Services

This is the supported list of connectors for Storage Services:

{% partial file="/v1.8/connectors/storage/connectors-list.md" /%}

If you have a request for a new connector, don't hesitate to reach out in [Slack](https://slack.open-metadata.org/) or
open a [feature request](https://github.com/open-metadata/OpenMetadata/issues/new/choose) in our GitHub repo.

## Configuring the Ingestion

In any other connector, extracting metadata happens automatically. We have different ways to understand the information
in the sources and send that to OpenMetadata. However, what happens with generic sources such as S3 buckets, or ADLS containers?

In these systems we can have different types of information:
- Unstructured data, such as images or videos,
- Structured data in single and independent files (which can also be ingested with the [S3 Data Lake connector](/connectors/database/s3-datalake))
- Structured data in partitioned files, e.g., `my_table/year=2022/...parquet`, `my_table/year=2023/...parquet`, etc.

{% note %}

The Storage Connector will help you bring in **Structured data in partitioned files**.

{% /note %}

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

{% partial file="/v1.8/connectors/storage/manifest.md" /%}

## Example

Let's show an example on how the data process and metadata look like. We will work with S3, using a global manifest,
and two buckets.

### S3 Data

In S3 we have:

```
S3
|__ om-glue-test  # bucket
|    |__ openmetadata_storage_manifest.json  # Global Manifest
|__ collate-demo-storage  # bucket
     |__ cities_multiple_simple/
     |    |__ 20230412/
     |         |__ State=AL/  # Directory with parquet files
     |         |__ State=AZ/  # Directory with parquet files
     |__ cities_multiple/
     |    |__ Year=2023/ 
     |         |__ State=AL/  # Directory with parquet files
     |         |__ State=AZ/  # Directory with parquet files
     |__ cities/
     |    |__ State=AL/  # Directory with parquet files
     |    |__ State=AZ/  # Directory with parquet files
     |__ transactions_separator/  # Directory with CSV files using ;
     |__ transactions/  # Directory with CSV files using ,
```

1. We have a bucket `om-glue-test` where our `openmetadata_storage_manifest.json` global manifest lives.
2. We have another bucket `collate-demo-storage` where we want to ingest the metadata of 5 partitioned containers with different formats
   1. The `cities_multiple_simple` container has a time partition (formatting just a date) and a `State` partition.
   2. The `cities_multiple` container has a `Year` and a `State` partition.
   3. The `cities` container is only partitioned by `State`.
   4. The `transactions_separator` container contains multiple CSV files separated by `;`.
   5. The `transactions` container contains multiple CSV files separated by `,`.

The ingestion process will pick up a random sample of files from the directories (or subdirectories).

### Global Manifest

Our global manifest looks like follows:

```json
{
    "entries":[
        {
            "dataPath": "transactions",
            "structureFormat": "csv",
            "isPartitioned": false,
            "containerName": "collate-demo-storage"
        },
        {
            "dataPath": "solution.pdf",
        },
        {
            "dataPath": "transactions_separator",
            "structureFormat": "csv",
            "isPartitioned": false,
            "separator": ";",
            "containerName": "collate-demo-storage"
        },
        {
            "dataPath": "cities",
            "structureFormat": "parquet",
            "isPartitioned": true,
            "containerName": "collate-demo-storage"
        },
        {
            "dataPath": "cities_multiple",
            "structureFormat": "parquet",
            "isPartitioned": true,
            "containerName": "collate-demo-storage",
            "partitionColumns": [
                {
                    "name": "Year",
                    "dataType": "DATE",
                    "dataTypeDisplay": "date (year)"
                },
                {
                    "name": "State",
                    "dataType": "STRING"
                }
            ]
        },
        {
            "dataPath": "cities_multiple_simple",
            "structureFormat": "parquet",
            "isPartitioned": true,
            "containerName": "collate-demo-storage",
            "partitionColumns": [
                {
                    "name": "State",
                    "dataType": "STRING"
                }
            ]
        }
    ]
}
```

We are specifying:
1. Where to find the data for each container we want to ingest via the `dataPath`,
2. The `format`,
3. Indication if the data has sub partitions or not (e.g., `State` or `Year`),
4. The `containerName`, so that the process knows in which S3 bucket to look for this data.

### Source Config

In order to prepare the ingestion, we will:
1. Set the `sourceConfig` to include only the containers we are interested in.
2. Set the `storageMetadataConfigSource` pointing to the global manifest stored in S3, specifying the container name as `om-glue-test`.

```yaml
source:
   type: s3
   serviceName: s3-demo
   serviceConnection:
      config:
         type: S3
         awsConfig:
            awsAccessKeyId: ... 
            awsSecretAccessKey: ... 
            awsRegion: ...
   sourceConfig:
      config:
         type: StorageMetadata
         containerFilterPattern:
            includes:
               - collate-demo-storage
               - om-glue-test
         storageMetadataConfigSource:
            securityConfig:
               awsAccessKeyId: ...
               awsSecretAccessKey: ...
               awsRegion: ...
            prefixConfig:
               containerName: om-glue-test
sink:
   type: metadata-rest
   config: {}
workflowConfig:
   openMetadataServerConfig:
      hostPort: http://localhost:8585/api
      authProvider: openmetadata
      securityConfig:
         jwtToken: "..."
```

You can run this same process from the UI, or directly with the `metadata` CLI via `metadata ingest -c <path to yaml>`.

### Checking the results

Once the ingestion process runs, we'll see the following metadata:

First, the service we called `s3-demo`, which has the two buckets we included in the filter.

{% image src="/images/v1.8/connectors/storage/s3-demo.png" alt="s3-demo" /%}

Then, if we click on the `collate-demo-storage` container, we'll see all the children defined in the manifest.

{% image src="/images/v1.8/connectors/storage/collate-demo-storage.png" alt="s3-demo" /%}

- **cities**: Will show the columns extracted from the sampled parquet files, since there is no partition columns specified.
- **cities_multiple**: Will have the parquet columns and the `Year` and `State` columns indicated in the partitions.
- **cities_multiple_simple**: Will have the parquet columns and the `State` column indicated in the partition.
- **transactions** and **transactions_separator**: Will have the CSV columns.
