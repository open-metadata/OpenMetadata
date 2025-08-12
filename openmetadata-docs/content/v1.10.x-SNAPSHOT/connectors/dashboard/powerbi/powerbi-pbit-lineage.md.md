---
title: Lineage from pbit files
slug: /connectors/dashboard/powerbi/powerbi-pbit-lineage
---

# Lineage from pbit files

In this section, we provide guides and references to get the lineage between `DataSource Tables <-> PowerBI Datasets <-> PowerBI Reports`.

## Follow the below steps to generate the lineage

### 1. Generate the .pbit files
The PowerBI connector will parse the .pbit files generated using PowerBI desktop application to generate the lineage.
Export the .pbit file for your PowerBI Reports by following the guide [here](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-templates#creating-report-templates)

### 2. Select the source to pick the files from
Use any one of the below sources to store the .pbit files and configure these sources in the PowerBI connector

- local: Provide the full path of your folder in the local system where the pbit files are stored. For the powerbi ingestion to pick these files, the ingestion should be running on the same system where the files are stored.

- azure: Store the pbit files in a Azure datalake bucket and specify the bucket name and path where the files are stored.

- s3: Store the pbit files in a S3 bucket and specify the bucket name and path where the files are stored.

- gcs: Store the pbit files in a GCS bucket and specify the bucket name and path where the files are stored.

### 3. Configure the source with PowerBI connector
### Run from UI
Select the source for the .pbit files from UI and add the connection for it
{% image
  src="/images/v1.10/connectors/powerbi/pbit-file-source.png"
  alt="pbit-file-sources"
  caption="pbit file sources"
 /%}

 ### Run Externally

Choose one of the configs for local, azure, s3 and gcs by modifying `pbitFilesSource` from below yaml and run the connector by following steps [here](/connectors/dashboard/powerbi/yaml).

```yaml
source:
  type: powerbi
  serviceName: local_powerbi
  serviceConnection:
    config:
      clientId: client_id
      clientSecret: client_secret
      tenantId: tenant_id
      scope:
        - https://analysis.windows.net/powerbi/api/.default
      pagination_entity_per_page: 100
      # useAdminApis: true or false
      # For pbit files, choose one of Local, S3, Azure or GCS configurations
      # # For local
      # pbitFilesSource:
      #   pbitFileConfigType: local
      #   path: "/path/to/pbit/files"
      #   pbitFilesExtractDir: "/path/to/extract/pbit/files"
      # # For S3
      # pbitFilesSource:
      #   pbitFileConfigType: s3
      #   securityConfig:  # These are modeled after all AWS credentials
      #     awsAccessKeyId: KEY
      #     awsSecretAccessKey: SECRET
      #     awsRegion: us-east-2
      #   prefixConfig:
      #     bucketName: bucket_name
      #     objectPrefix: "main_dir/pbit_files"
      #   pbitFilesExtractDir: "/path/to/extract/pbit/files"
      # # For Azure
      # pbitFilesSource:
      #   pbitFileConfigType: azure
      #   securityConfig:
      #     clientId: clientId
      #     clientSecret: clientSecret
      #     tenantId: tenantId
      #     accountName: accountName
      #   prefixConfig:
      #     bucketName: bucket_name
      #     objectPrefix: "main_dir/pbit_files"
      #   pbitFilesExtractDir: "/path/to/extract/pbit/files"
      # # For GCS
      # pbitFilesSource:
      #   pbitFileConfigType: gcs
      #   securityConfig:
      #     gcpConfig:
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
      #   prefixConfig:
      #     bucketName: bucket_name
      #     objectPrefix: "main_dir/pbit_files"
      #   pbitFilesExtractDir: "/path/to/extract/pbit/files"
      type: PowerBI
  sourceConfig:
    config:
      type: DashboardMetadata
      lineageInformation:
        dbServiceNames:
        - snowflake_service
        - redshift_service
      chartFilterPattern:
        includes:
          - Gross Margin %
          - Total Defect*
          - "Number"
        excludes:
          - Total Revenue
      dashboardFilterPattern:
        includes:
          - Supplier Quality Analysis Sample
          - "Customer"
      projectFilterPattern:
        includes:
          - Supplier Quality Analysis Sample
          - "Customer"
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "your_jwt_token"
```

### 4. Run the PowerBI connector
Add  `dbServiceNames` under `lineageInformation` to create lineage between datasource Tables and PowerBI datasets.
After running the PowerBI connector, the connector will gather these files and extract the files under path specified at `pbitFilesExtractDir` (directory will be created if not present). Then the extracted contents will be used to create the lineage.

{% note %} 

Make sure to provide enough permissions under the `pbitFilesExtractDir` to be able to extract the pbit files.
{% /note %}

