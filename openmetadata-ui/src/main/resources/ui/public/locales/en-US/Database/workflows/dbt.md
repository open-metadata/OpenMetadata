# Metadata

dbt Pipeline Configuration.

## Configuration

$$section
### dbt Config Source $(id="dbtConfigSource")

You can choose one of the 5 sources to fetch the dbt files:
1. **dbt Local Config**: Config to fetch dbt files from local system.
2. **dbt HTTP Config**: Config to fetch dbt files from an HTTP or File Server.
3. **dbt Cloud Config**: Config to fetch the dbt files from dbt cloud APIs
4. **dbt S3 Config**: Config to fetch the dbt files from s3.
5. **dbt GCS Config**: Config to fetch the dbt files from gcp.
$$

$$section
### dbt Local Config $(id="dbtLocalConfig")

In this configuration, we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from the same host that is running the ingestion process.
$$

$$section
#### dbt Catalog File Path $(id="dbtCatalogFilePath")

This is an optional file. You should provide the full file path of the dbt `catalog.json` file, e.g., `/root/folder/catalog.json`.
$$

$$section
#### dbt Manifest File Path $(id="dbtManifestFilePath")

This is a mandatory file for dbt ingestion. You should provide the full file path of the dbt `manifest.json` file, e.g., `/root/folder/manifest.json`.

$$

$$section
#### dbt Run Results File Path $(id="dbtRunResultsFilePath")

This is an optional file. If not informed, dbt tests and their results will not be imported.

You should provide the full file path of the dbt `run_results.json` file, e.g., `/root/folder/run_results.json`.
$$

---

$$section
### dbt HTTP Config $(id="dbtHttpConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from an HTTP or File Server.

If your files are available on GitHub for a public repository, you can pass the raw URL of the file, e.g., `https://raw.githubusercontent.com/dbtfiles/master/manifest.json`
$$

$$section
#### dbt Catalog HTTP Path $(id="dbtCatalogHttpPath")

This is an optional file. You should provide the full HTTP path of the dbt `catalog.json` file, e.g., `https://localhost/files/catalog.json`.

$$

$$section
#### dbt Manifest HTTP Path $(id="dbtManifestHttpPath")

This is a mandatory file for dbt ingestion. You should provide the full HTTP path of the dbt `manifest.json` file, e.g., `https://localhost/files/manifest.json`.
$$

$$section
#### dbt Run Results HTTP Path $(id="dbtRunResultsHttpPath")

This is an optional file. If not informed, dbt tests and test results will not be imported

You should provide the full HTTP path of the dbt `run_results.json` file, e.g., `https://localhost/files/run_results.json`.
$$

---

$$section
### dbt Cloud Config $(id="dbtCloudConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from dbt cloud APIs.

The `Account Viewer` permission is the minimum requirement for the dbt cloud token.
$$

$$section
#### dbt Cloud Account ID $(id="dbtCloudAccountId")

To obtain your dbt Cloud account ID, sign in to dbt Cloud in your browser. Take note of the number directly following the accounts path component of the URL -- this is your account ID.

For example, if the URL is `https://cloud.getdbt.com/#/accounts/1234/projects/6789/dashboard/`, the account ID is `1234`.
$$

$$section
#### dbt Cloud Authentication Token $(id="dbtCloudAuthToken")

Please follow the instructions in [dbt Cloud's API](https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens) documentation to create a dbt Cloud API token.
$$

$$section
#### dbt Cloud Project ID $(id="dbtCloudProjectId")

In case of multiple projects in a dbt cloud account, specify the project's ID from which you want to extract the dbt run artifacts.

If left empty, the dbt artifacts will be fetched from the most recent run on dbt cloud.

To find your project ID, sign in to your dbt cloud account and choose a specific project. Take note of the url which will be similar to `https://cloud.getdbt.com/#/accounts/1234/settings/projects/6789/`, the project ID is `6789`.

The value entered should be a `numeric` value.
$$

$$section
#### dbt Cloud Job ID $(id="dbtCloudJobId")

In case of multiple jobs in a dbt cloud account, specify the job's ID from which you want to extract the dbt run artifacts.

If left empty, the dbt artifacts will be fetched from the most recent run on dbt cloud.

After creating a dbt job, take note of the url which will be similar to `https://cloud.getdbt.com/#/accounts/1234/projects/6789/jobs/553344/`. The job ID is `553344`.

The value entered should be a `numeric` value.
$$

$$section
#### dbt Cloud URL $(id="dbtCloudUrl")

URL to connect to your dbt cloud instance. E.g., `https://cloud.getdbt.com` or `https://emea.dbt.com/`.
$$

---

$$section
### dbt S3 Config $(id="dbtS3Config")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from an S3 bucket.
$$

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
$$

---

$$section
### dbt GCS Config $(id="dbtGcsConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from a GCS bucket.

Check out [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.
$$

$$section
### GCS Credentials Path $(id="GCSCredentialsPath")

Pass the path of file containing the GCP service account keys.
$$

$$section
### Credentials Type $(id="type")

The account type defines the type of Google Cloud Account. To fetch this key, look for the value associated with the `type` key in the service account key file.
$$

$$section
### Project ID $(id="projectId")

A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file.
$$

$$section
### Private Key ID $(id="privateKeyId")

This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
$$

$$section
### Private Key $(id="privateKey")

This is the private key associated with the service account that is used to authenticate and authorize access to GCP. To fetch this key, look for the value associated with the `private_key` key in the service account file.
$$

$$section
### Client Email $(id="clientEmail")

This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
$$

$$section
### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.
$$

$$section
### Auth URI $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file.
$$

$$section
### Token URI $(id="tokenUri")

The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization.

To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file.
$$

$$section
### Auth Provider X509Cert URL $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file.
$$

$$section
### Client X509Cert URL $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key file.
$$

---

$$section
### dbt Bucket Name $(id="dbtBucketName")

Name of the bucket where the dbt files are stored.

- For S3, if the URL `s3://bucket-name/main-dir/dbt-files/` is where the dbt files are stored, enter `bucket-name` in the field.

- For GCS, if the path `bucket-name/main-dir/dbt_files` is where the dbt files are stored, enter `bucket-name` in the field.

$$

$$section
### dbt Object Prefix $(id="dbtObjectPrefix")

Path of the folder where the dbt files are stored.

- For S3, if the URL `s3://bucket-name/main-dir/dbt-files/` is where the dbt files are stored, enter `main-dir/dbt-files/` in the field.

- For GCS, if the path `bucket-name/main-dir/dbt_files` is where the dbt files are stored, enter `main-dir/dbt-files` in the field.
$$

$$section
### dbt Tags Classification Name $(id="dbtClassificationName")

Name of the classification under which the dbt tags will be created if the `Include dbt Tags` option is enabled.

By default, the classification name will be set to `dbtTags`.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$


$$section
### Search Tables Across Databases $(id="searchAcrossDatabases")

Option to search across database services for tables or not for processing dbt metadata ingestion.
If this option is enabled, OpenMetadata will first search for tables within the same database service if tables are not found it will search across all database services.

If the option is disabled, the search will be limited to the tables within the same database service.
$$

$$section
### Update Descriptions $(id="dbtUpdateDescriptions")

This options updates the table and column descriptions in OpenMetadata with descriptions from dbt.

If the option is disabled, only tables and columns without any existing descriptions will have their descriptions updated based on the dbt manifest. 

However, if the option is enabled, descriptions for all tables and columns in the dbt manifest will be updated in OpenMetadata.
$$

$$section
### Update Owners $(id="dbtUpdateOwners")

This options updates the table owner in OpenMetadata with owners from dbt.

If the option is disabled, only tables without any existing owners will have their owners updated based on the dbt manifest. 

However, if the option is enabled, owners for all tables and columns in the dbt manifest will be updated in OpenMetadata.
$$

$$section
### Include dbt Tags $(id="includeTags")

Option to include fetching the tags metadata from dbt. 

When enabled, OpenMetadata will fetch tags associated with tables and columns from dbt `manifest.json` and attach them to the corresponding tables in OpenMetadata.
$$


$$section
### Query Parsing Timeout Limit $(id="parsingTimeoutLimit")

Specify the timeout limit for parsing the sql queries to perform the lineage analysis.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$