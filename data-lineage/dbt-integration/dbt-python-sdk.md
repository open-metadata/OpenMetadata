---
description: We are going to show the integration of DBT with the Python SDK.
---

# DBT Python SDK

We will be going through a series of steps on how to configure DBT in OpenMetadata and how the python SDK parses the DBT `manifest.json` and `catalog.json` files.

### Adding DBT configuration in JSON Config

Below is an example showing the yaml config of the Redshift connector. The below example shows how to fetch the DBT files from AWS s3 bucket.

For more information on getting the DBT files from other sources like gcs, file server etc. please take a look [here](add-dbt-while-ingesting-from-cli.md#add-dbt-source).

```
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

Add the details of the AWS s3 bucket in the above config

dbtConfigSource: Details of the AWS s3 resource

dbtPrefixConfig: Bucket name and path of the dbt files in bucket

### Locate the DBT Files

The `get_dbt_details` \_\_ method takes in the source config provided in the json and detects source type (gcs, s3, local or file server) based on the fields provided in the config.

```
from metadata.utils.dbt_config import get_dbt_details

dbt_details = get_dbt_details(dbtConfigSource)
dbt_catalog = dbt_details[0] if dbt_details else None
dbt_manifest = dbt_details[1] if dbt_details else None
```

After scanning the buckets or the path provided the `manifest` and `catalog` files fetched.

### Parsing the DBT Files

The `_parse_data_model` method parses the `manifest` and `catalog` files that are fetched and converts the DBT data into `DataModel`

```
from metadata.ingestion.source.sql_source import _parse_data_model()

_parse_data_model()
```

### Extracting the DBT data

The models which are extracted are shown in the Openmetada UI in the `DBT` tab

![DBT Models](<../../.gitbook/assets/image (9) (1) (1).png>)
