---
title: dbt Workflow
slug: /connectors/ingestion/workflows/dbt
---

# dbt Workflow

{%inlineCalloutContainer%}

{%inlineCallout
  icon="celebration"
  bold="dbt Workflow from UI"
  href="/connectors/ingestion/workflows/dbt/ingest-dbt-ui"%}
Configure the dbt Workflow from the UI.

{%/inlineCallout%}

{%inlineCallout
  icon="celebration"
  bold="dbt Workflow from CLI"
  href="/connectors/ingestion/workflows/dbt/ingest-dbt-cli"%}
Configure the dbt Workflow from the CLI.
{%/inlineCallout%}

{%/inlineCalloutContainer%}

# dbt Integration

{% multiTablesWrapper %}

| Feature                     | Status                            |
| :-------------------------- | :-------------------------------- |
| Stage                       | PROD                              |
| dbt Queries                 | {% icon iconName="check" /%}      |
| dbt Lineage                 | {% icon iconName="check" /%}      |
| dbt Tags                    | {% icon iconName="check" /%}      |
| dbt Owner                   | {% icon iconName="check" /%}      |
| dbt Descriptions            | {% icon iconName="check" /%}      |
| dbt Tests                   | {% icon iconName="check" /%}      |
| Supported dbt Core Versions | `v1.2` `v1.3` `v1.4` `v1.5` `v1.6`|

{% /multiTablesWrapper %}

## Requirements

### AWS S3

If we have the artifacts on the bucket `MyBucket`, the user running the ingestion should have, at least, the permissions
from the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::MyBucket",
                "arn:aws:s3:::MyBucket/*"
            ]
        }
    ]
}
```

Note that it's not enough to point the resource to `arn:aws:s3:::MyBucket`. We need its contents as well!


## OpenMetadata integrates the below metadata from dbt

### 1. dbt Queries

Queries used to create the dbt models can be viewed in the dbt tab

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-query.png"
  alt="dbt-query"
  caption="dbt Query"
 /%}


### 2. dbt Lineage

Lineage from dbt models can be viewed in the Lineage tab.

For more information on how lineage is extracted from dbt take a look [here](/connectors/ingestion/workflows/dbt/ingest-dbt-lineage)

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-lineage.png"
  alt="dbt-lineage"
  caption="dbt Lineage"
 /%}


### 3. dbt Tags

Table and column level tags can be imported from dbt

Please refer [here](/connectors/ingestion/workflows/dbt/ingest-dbt-tags) for adding dbt tags

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-tags.png"
  alt="dbt-tags"
  caption="dbt Tags"
 /%}



### 4. dbt Owner

Owner from dbt models can be imported and assigned to respective tables

Please refer [here](/connectors/ingestion/workflows/dbt/ingest-dbt-owner) for adding dbt owner

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-owner.png"
  alt="dbt-owner"
  caption="dbt Owner"
 /%}


### 5. dbt Descriptions

Descriptions from dbt `manifest.json` and `catalog.json` can be imported and assigned to respective tables and columns.

For more information and to control how the table and column descriptions are updated from dbt please take a look [here](/connectors/ingestion/workflows/dbt/ingest-dbt-descriptions)

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-descriptions.png"
  alt="dbt-descriptions"
  caption="dbt Descriptions"
 /%}


### 6. dbt Tests and Test Results

Tests from dbt will only be imported if the `run_results.json` file is passed.

{% image
  src="/images/v1.1/features/ingestion/workflows/dbt/dbt-features/dbt-tests.png"
  alt="dbt-tests"
  caption="dbt Tests"
 /%}

## Troubleshooting

For any issues please refer to the troubleshooting documentation [here](/connectors/ingestion/workflows/dbt/dbt-troubleshooting)
