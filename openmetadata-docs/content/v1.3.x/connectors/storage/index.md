---
title: Storage Services
slug: /connectors/storage
---

# Storage Services

This is the supported list of connectors for Storage Services:

{% connectorsListContainer %}

{% connectorInfoCard name="S3" stage="PROD" href="/connectors/storage/s3" platform="OpenMetadata" / %}

{% /connectorsListContainer %}

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

{% partial file="/v1.3/connectors/storage/manifest.md" /%}
