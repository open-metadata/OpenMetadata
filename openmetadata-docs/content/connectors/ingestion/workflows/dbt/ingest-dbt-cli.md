---
title: Ingest dbt CLI
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-cli
---

# dbt Workflow CLI
Learn how to configure the dbt workflow from the cli to ingest dbt data from your data sources.

## CLI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add the dbt information.

This will populate the dbt tab from the Table Entity Page.

<Image src="/images/openmetadata/ingestion/workflows/dbt/dbt-features/dbt-query.webp" alt="dbt" caption="dbt"/>

We can create a workflow that will obtain the dbt information from the dbt files and feed it to OpenMetadata. The dbt Ingestion will be in charge of obtaining this data.

### 1. Create the workflow configuration

Configure the dbt.yaml file according keeping only one of the required source (local, http, gcs, s3).
The dbt files should be present on the source mentioned and should have the necssary permissions to be able to access the files.

Enter the name of your database service from OpenMetadata in the `serviceName` key in the yaml

```yaml
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
      # For dbt, choose one of Cloud, Local, HTTP, S3 or GCS configurations
      # dbtConfigSource:
      # # For cloud
      #   dbtCloudAuthToken: token
      #   dbtCloudAccountId: ID
      #   dbtCloudProjectId: project_id
      # # For Local
      #   dbtCatalogFilePath: path-to-catalog.json
      #   dbtManifestFilePath: path-to-manifest.json
      #   dbtRunResultsFilePath: path-to-run_results.json
      # # For HTTP
      #   dbtCatalogHttpPath: http://path-to-catalog.json
      #   dbtManifestHttpPath: http://path-to-manifest.json
      #   dbtRunResultsHttpPath: http://path-to-run_results.json
      # # For S3
      #   dbtSecurityConfig:  # These are modeled after all AWS credentials
      #     awsAccessKeyId: KEY
      #     awsSecretAccessKey: SECRET
      #     awsRegion: us-east-2
      #   dbtPrefixConfig:
      #     dbtBucketName: bucket
      #     dbtObjectPrefix: "dbt/"
      # # For GCS Values
      #   dbtSecurityConfig:  # These are modeled after all GCS credentials
      #     gcsConfig:
      #       type: My Type
      #       projectId: project ID
      #       privateKeyId: us-east-2
      #       privateKey: |
      #         -----BEGIN PRIVATE KEY-----
      #         Super secret key
      #         -----END PRIVATE KEY-----
      #       clientEmail: client@mail.com
      #       clientId: 1234
      #       authUri: https://accounts.google.com/o/oauth2/auth (default)
      #       tokenUri: https://oauth2.googleapis.com/token (default)
      #       authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
      #       clientX509CertUrl: https://cert.url (URI)
      # # For GCS Values
      #   dbtSecurityConfig:  # These are modeled after all GCS credentials
      #     gcsConfig: path-to-credentials-file.json
      #   dbtPrefixConfig:
      #     dbtBucketName: bucket
      #     dbtObjectPrefix: "dbt/"
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

### 2. Run the dbt ingestion

After saving the YAML config, we will run the command for dbt ingestion

```bash
metadata ingest -c <path-to-yaml>
```
