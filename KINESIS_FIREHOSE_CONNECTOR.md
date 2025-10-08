# Kinesis Firehose

**Stage**: PROD

**Available Features:**
- Pipelines
- Lineage (Entity-level and Column-level)

## Requirements

OpenMetadata relies on AWS Boto3 client for connecting to Kinesis Firehose and extracting metadata.

The user must have the following permissions to successfully extract metadata:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "firehose:ListDeliveryStreams",
        "firehose:DescribeDeliveryStream"
      ],
      "Resource": "*"
    }
  ]
}
```

## Metadata Ingestion

### 1. Visit the Services Page

Navigate to **Settings >> Services >> Pipelines** to start configuring a new Kinesis Firehose service.

### 2. Create a New Service

Click on **Add New Service** to begin the configuration process.

### 3. Select Service Type

Select **Kinesis Firehose** as the service type from the list of available pipeline services.

### 4. Name and Describe Your Service

Provide a unique name and description for your Kinesis Firehose service connection. The service name must be unique within your OpenMetadata instance.

### 5. Configure Service Connection

You can configure the service connection by providing the following details:

#### **AWS Access Key ID** (Optional)
Your AWS access key ID for authentication.

#### **AWS Secret Access Key** (Optional)
Your AWS secret access key for authentication.

#### **AWS Region** (Required)
The AWS region where your Firehose delivery streams are deployed (e.g., `us-east-1`, `eu-west-1`).

#### **AWS Session Token** (Optional)
Temporary session token for accessing AWS services when using temporary credentials.

#### **Endpoint URL** (Optional)
Custom endpoint URL for Kinesis Firehose service. Useful for testing with LocalStack or other AWS-compatible services.

#### **Profile Name** (Optional)
The name of a profile to use from your AWS credentials file (`~/.aws/credentials`).

#### **Assume Role ARN** (Optional)
The Amazon Resource Name (ARN) of an IAM role to assume for cross-account access or elevated permissions.

#### **Assume Role Session Name** (Optional)
An identifier for the assumed role session. Defaults to `OpenMetadataSession`.

#### **Assume Role Source Identity** (Optional)
Source identity to include in the assumed role session.

### 6. Test Connection

Click on **Test Connection** to validate your credentials and ensure OpenMetadata can successfully connect to Kinesis Firehose and list delivery streams.

### 7. Configure Metadata Ingestion

#### **Pipeline Filter Pattern** (Optional)
Use filter patterns to control which delivery streams should be included or excluded during metadata ingestion. Supports regular expressions for flexible filtering.

- **Include**: Define patterns for delivery streams to include (e.g., `prod-.*`, `cdc-.*`)
- **Exclude**: Define patterns for delivery streams to exclude (e.g., `test-.*`, `temp-.*`)

#### **Include Lineage** (Toggle)
Enable this option to extract and display lineage information showing data flow from DynamoDB tables through Firehose delivery streams to destinations (S3, Redshift, OpenSearch, Snowflake).

#### **Enable Debug Logs** (Toggle)
Set the logging level to DEBUG for troubleshooting connection and ingestion issues.

#### **Mark Deleted Pipelines** (Toggle)
Enable this option to soft-delete delivery streams in OpenMetadata that no longer exist in AWS Firehose.

### 8. Schedule Ingestion

Configure the ingestion schedule based on your requirements:

- **Hourly**: Ingest metadata every hour
- **Daily**: Ingest metadata once per day
- **Weekly**: Ingest metadata once per week
- **Manual**: Trigger ingestion manually as needed

All schedules run in UTC timezone. You can optionally configure start and end dates for the ingestion pipeline.

### 9. Deploy and View Ingested Data

Once configured, deploy the ingestion pipeline. Navigate to the **Pipelines** section to view your Kinesis Firehose delivery streams with their metadata and lineage information.

## Metadata Extracted

OpenMetadata extracts the following metadata from Kinesis Firehose:

- **Delivery Stream Name**: The name of the Firehose delivery stream
- **Delivery Stream ARN**: The Amazon Resource Name of the delivery stream
- **Delivery Stream Status**: Current status (ACTIVE, CREATING, DELETING, etc.)
- **Delivery Stream Type**: Source type (DirectPut, KinesisStreamAsSource, MSKAsSource)
- **Source Configuration**: Details about the data source (e.g., Kinesis stream ARN for DynamoDB streams)
- **Destination Configuration**: Details about S3, Redshift, OpenSearch, Snowflake, or HTTP endpoint destinations
- **Create and Update Timestamps**: When the delivery stream was created and last modified

## Lineage

When **Include Lineage** is enabled, OpenMetadata automatically captures both entity-level and column-level lineage.

### Entity-Level Lineage

The connector creates lineage edges between source and destination entities:

- **DynamoDB Table → Firehose Pipeline → S3 Container**: When the delivery stream source is a DynamoDB stream and the destination is S3
- **DynamoDB Table → Firehose Pipeline → Redshift Table**: When the destination is Amazon Redshift
- **DynamoDB Table → Firehose Pipeline → OpenSearch Index**: When the destination is Amazon OpenSearch Service
- **DynamoDB Table → Firehose Pipeline → Snowflake Table**: When the destination is Snowflake

### Column-Level Lineage

For table-to-table and table-to-index lineage, the connector automatically creates column-level mappings:

- Columns are matched by name (case-insensitive)
- Since Firehose is a delivery service without data transformation, columns typically have the same names in source and destination
- Column lineage is only created when both source and destination entities have column metadata in OpenMetadata

### Lineage Requirements

For lineage to be created, the following conditions must be met:

1. **Source Entity Must Exist**: The DynamoDB table must be ingested into OpenMetadata via the DynamoDB connector
2. **Destination Entity Must Exist**: The destination (S3 container, Redshift table, OpenSearch index, or Snowflake table) must be ingested via the respective connector
3. **Include Lineage Enabled**: The "Include Lineage" toggle must be enabled in the ingestion configuration

If entities are not found, the connector logs helpful warning messages indicating which entities need to be configured.

## Supported Destinations

The Kinesis Firehose connector supports lineage for the following destination types:

### Amazon S3
- Extracts bucket name and prefix from `S3DestinationDescription` or `ExtendedS3DestinationDescription`
- Creates lineage to S3 containers in OpenMetadata
- Supports both standard and extended S3 configurations

### Amazon Redshift
- Parses JDBC connection URL to extract database name
- Extracts table name from `CopyCommand.DataTableName`
- Searches for Redshift tables across common schema patterns (public, default)
- Requires Redshift connector to have ingested the destination table

### Amazon OpenSearch Service
- Extracts index name from `AmazonopensearchserviceDestinationDescription`
- Searches across all OpenSearch/Elasticsearch services in OpenMetadata
- Supports both domain ARN and cluster endpoint configurations

### Snowflake
- Extracts database, schema, and table names from `SnowflakeDestinationDescription`
- Creates fully qualified lineage paths
- Requires Snowflake connector to have ingested the destination table

### MongoDB (HTTP Endpoint)
- Detects MongoDB Atlas HTTP endpoints
- Currently logs a warning that MongoDB lineage is not yet supported
- Future support requires MongoDB connector implementation

## Authentication Methods

The Kinesis Firehose connector supports all standard AWS authentication methods:

### 1. Access Key and Secret (Development/Testing)
```yaml
awsConfig:
  awsAccessKeyId: "AKIAIOSFODNN7EXAMPLE"
  awsSecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  awsRegion: "us-east-1"
```

### 2. Session Token (Temporary Credentials)
```yaml
awsConfig:
  awsAccessKeyId: "ASIAIOSFODNN7EXAMPLE"
  awsSecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  awsSessionToken: "FwoGZXIvYXdzEBYaDB..."
  awsRegion: "us-east-1"
```

### 3. AWS Profile
```yaml
awsConfig:
  profileName: "openmetadata-profile"
  awsRegion: "us-east-1"
```

### 4. Assume Role (Cross-Account Access)
```yaml
awsConfig:
  assumeRoleArn: "arn:aws:iam::123456789012:role/OpenMetadataFirehoseRole"
  assumeRoleSessionName: "OpenMetadataFirehoseSession"
  assumeRoleSourceIdentity: "arn:aws:iam::987654321098:user/admin"  # optional
  awsRegion: "us-east-1"
```

### 5. Default Credential Chain
```yaml
awsConfig:
  awsRegion: "us-east-1"
  # No explicit credentials - uses EC2 instance role, ECS task role, or environment variables
```

## Configuration Example

```yaml
source:
  type: kinesisfirehose
  serviceName: aws_firehose_production
  serviceConnection:
    config:
      type: KinesisFirehose
      awsConfig:
        awsRegion: us-east-1
        awsAccessKeyId: <access-key>
        awsSecretAccessKey: <secret-key>
  sourceConfig:
    config:
      type: PipelineMetadata
      pipelineFilterPattern:
        includes:
          - "prod-.*"
          - "cdc-.*"
        excludes:
          - "test-.*"
      includeLineage: true

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "<your-jwt-token>"
```

## Troubleshooting

### Lineage Not Created

**Issue**: Delivery streams are ingested but lineage is not appearing

**Solutions**:
1. Verify both source and destination entities exist in OpenMetadata:
   - Check that DynamoDB table is ingested
   - Check that destination (S3, Redshift, etc.) is ingested
2. Enable debug logging and check for warning messages
3. Verify "Include Lineage" is enabled in the configuration

### Column Lineage Missing

**Issue**: Entity lineage exists but column-level lineage is not showing

**Solutions**:
1. Ensure source DynamoDB table has column metadata
2. Ensure destination table/index has column metadata
3. Check that column names match (case-insensitive) between source and destination

### Authentication Failed

**Issue**: Cannot connect to AWS Firehose

**Solutions**:
1. Verify AWS credentials are correct
2. Check IAM permissions include `firehose:ListDeliveryStreams` and `firehose:DescribeDeliveryStream`
3. Verify AWS region is correct
4. For assume role, ensure trust relationship is configured properly

### Throttling Errors

**Issue**: Receiving AWS throttling exceptions

**Solutions**:
- The connector includes automatic retry logic with exponential backoff
- If errors persist, reduce the number of concurrent ingestion processes
- Consider requesting AWS service limit increase for Firehose API calls

### Destination Not Found

**Issue**: Warning messages about destination entities not found

**Solutions**:
1. Run the appropriate destination connector first (S3, Redshift, OpenSearch, Snowflake)
2. Verify the destination entity name matches exactly
3. For Redshift, check that the schema (public/default) matches the ingested schema

## Best Practices

1. **Run Dependency Connectors First**: Before running Firehose ingestion, ensure you've run:
   - DynamoDB connector (for source tables)
   - S3/Redshift/OpenSearch/Snowflake connector (for destination entities)

2. **Enable Lineage**: Always enable "Include Lineage" to capture data flow relationships

3. **Use Assume Role in Production**: For production environments, use IAM roles with assume role rather than access keys

4. **Filter Streams**: Use pipeline filter patterns to focus on relevant delivery streams and reduce ingestion time

5. **Schedule Regular Ingestion**: Set up daily or weekly ingestion schedules to keep metadata current

6. **Monitor Logs**: Enable debug logging initially to verify lineage creation, then switch to INFO for production

## Related Documentation

- [AWS Kinesis Firehose Documentation](https://aws.amazon.com/firehose/)
- [AWS IAM Policies for Firehose](https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html)
- [OpenMetadata Pipeline Services](https://docs.open-metadata.org/connectors/pipeline)
- [OpenMetadata Lineage](https://docs.open-metadata.org/openmetadata/data-insight/data-lineage)

## Known Limitations

1. **MongoDB Lineage**: HTTP endpoint destinations pointing to MongoDB are detected but lineage is not yet created. This requires MongoDB connector support in OpenMetadata.

2. **Generic HTTP Endpoints**: Only MongoDB HTTP endpoints are detected. Other HTTP endpoints (Datadog, Splunk, New Relic) are not yet supported.

3. **Pipeline Status**: Firehose delivery streams are continuous services without discrete job runs, so pipeline status/execution history is not applicable.

4. **Lambda Transformations**: Data transformation Lambda functions are not yet parsed for lineage metadata.

## Support

For issues, feature requests, or questions about the Kinesis Firehose connector:
- Open an issue on the OpenMetadata GitHub repository
- Join the OpenMetadata Slack community
- Check the OpenMetadata documentation at https://docs.open-metadata.org
