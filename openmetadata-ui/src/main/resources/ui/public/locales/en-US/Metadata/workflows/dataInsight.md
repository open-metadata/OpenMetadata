# Data Insight Ingestion

Data Insight Ingestion Pipeline Configuration.


You can find further information on the Data Insight Ingestion in the <a href="https://docs.open-metadata.org/openmetadata/data-insight" target="_blank">docs</a>.

$$section

### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section

### CA Certificates $(id="caCerts")

The Certificate path needs to be added in the configuration. The path should be local in the Ingestion Container.
$$

$$section

### Region Name $(id="regionName")

Region name is required when using AWS Credentials.

Each AWS Region is a separate geographic area in which AWS clusters data centers (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">docs</a>).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.
$$

$$section

### Timeout $(id="timeout")

Connection Timeout.
$$

$$section

### Use AWS Credentials $(id="useAwsCredentials")

Indicates whether to use AWS credentials when connecting to OpenSearch in AWS.
$$

$$section

### Verify Certificates $(id="useSSL")

This indicates whether to use SSL when connecting to Elasticsearch. By default, we will ignore SSL settings.
$$

$$section

### Enable Debug Logs $(id="verifyCerts")

This indicates whether to verify certificates when using SSL connection to Elasticsearch. It's ignored by default and is set to true. Ensure that you send the certificates in the property `CA Certificates`.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$