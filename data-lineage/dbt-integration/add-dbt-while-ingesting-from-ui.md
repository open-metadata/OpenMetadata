# Add DBT while ingesting from UI

Provide and configure the DBT manifest and catalog file source locations.

* [Requirements](add-dbt-while-ingesting-from-ui.md#undefined)
* [Add DBT Source](add-dbt-while-ingesting-from-ui.md#undefined)

## Requirements

Refer to the documentation [here](https://docs.getdbt.com/docs/introduction) to setup a DBT project, generate the DBT models and store them in the catalog and manifest files.

Please make sure to have necessary permissions enabled so that the files can be read from their respective sources.

## Add DBT Source

DBT sources for manifest and catalog files can be configured as shown UI below.

#### AWS S3 Buckets

OpenMetadata connects to the AWS s3 bucket via the credentials provided and scans the AWS s3 buckets for `manifest.json` and `catalog.json` files.

The name of the s3 bucket and prefix path to the folder in which `manifest.json` and `catalog.json` files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

![Enter AWS S3 bucket credentials in which the DBT files are stored](<../../.gitbook/assets/image (87) (1) (1).png>)

#### Google Cloud Storage Buckets

OpenMetadata connects to the GCS bucket via the credentials provided and scans the gcs buckets for `manifest.json` and `catalog.json` files.

The name of the GCS bucket and prefix path to the folder in which `manifest.json` and `catalog.json` files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

GCS credentials can be stored in two ways:

Entering the credentials directly into the form

![Enter the GCS bucket credentials in which the DBT files are stored](<../../.gitbook/assets/image (62).png>)

Entering the path of file in which the GCS bucket credentials are stored.

![Enter the path of the GCS credentials file](<../../.gitbook/assets/image (5) (2).png>)

For more information on Google Cloud Storage authentication click [here](https://cloud.google.com/docs/authentication/getting-started#create-service-account-console).

#### Local Storage

Path of the `manifest.json` and `catalog.json` files stored in the local system or in the container in which openmetadata server is running can be directly provided.

![Enter the path of the DBT files](<../../.gitbook/assets/image (17).png>)

#### File Server

File server path of the `manifest.json` and `catalog.json` files stored on a file server directly provided.

![Enter the file server path of the DBT files](<../../.gitbook/assets/image (60).png>)
