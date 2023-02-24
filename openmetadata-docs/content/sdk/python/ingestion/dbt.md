---
title: Python SDK for dbt
slug: /sdk/python/ingestion/dbt
---

# Python SDK for dbt
We are going to show the integration of dbt with the Python SDK.

We will be going through a series of steps on how to configure dbt in OpenMetadata and how the python SDK parses the dbt `manifest.json`, `catalog.json` and `run_results.json` files.

## Adding dbt configuration in JSON Config
Below is an example showing the yaml config of the Redshift connector. The below example shows how to fetch the dbt files from AWS s3 bucket.

For more information on getting the dbt files from other sources like gcs, file server etc. please take a look [here](/sdk/python/ingestion/dbt#locate-the-dbt-files).

```yaml
source:
  type: redshift
  serviceName: aws_redshift
  serviceConnection:
    config:
      type: Redshift
      hostPort: cluster.name.region.redshift.amazonaws.com:5439
      username: username
      password: strong_password
      database: dev
  sourceConfig:
    config:
      dbtConfigSource:
      dbtSecurityConfig:
        awsAccessKeyId: <AWS Access Key Id>
        awsSecretAccessKey: <AWS Secret Access Key>
        awsRegion: AWS Region
      dbtPrefixConfig:
        dbtBucketName: <Bucket Name>
        dbtObjectPrefix: <Path of the folder in which dbt files are stored>
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

Add the details of the AWS s3 bucket in the above config:

- `dbtConfigSource`: Details of the AWS s3 resource
- `dbtPrefixConfig`: Bucket name and path of the dbt files in bucket

## Locate the dbt Files
The `get_dbt_details` method takes in the source config provided in the json and detects source type (gcs, s3, local or file server) based on the fields provided in the config.

```python
from metadata.utils.dbt_config import get_dbt_details

dbt_details = get_dbt_details(self.source_config.dbtConfigSource)
self.dbt_catalog = dbt_details[0] if dbt_details else None
self.dbt_manifest = dbt_details[1] if dbt_details else None
self.dbt_run_results = dbt_details[2] if dbt_details else None
```

After scanning the buckets or the path provided, the `manifest`,`catalog` and `run_results` files are fetched.

## Parsing the dbt Files
The `_parse_data_model` method parses the manifest, catalog and run_results files that are fetched and converts the dbt data into `DataModel`.

```python
from metadata.ingestion.source.database.dbt_source import _parse_data_model()

_parse_data_model()
```

## Extracting the dbt data
The models which are extracted are shown in the Openmetada UI in the `dbt` tab

<Image
src={"/images/sdk/python/ingestion/extracting-dbt-data.webp"}
alt="Extracting dbt data"
/>  