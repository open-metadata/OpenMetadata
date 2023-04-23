# Metadata

dbt Pipeline Configuration.
## Properties

$$section
### dbt Config Source $(id="dbtConfigSource")

You can choose one of the 5 sources to fetch the dbt files:
1. **dbt Local Config**: Config to fetch dbt files from local system.
2. **dbt HTTP Config**: Config to fetch dbt files from http or file server.
2. **dbt Cloud Config**: Config to fetch the dbt files from dbt cloud APIs
2. **dbt S3 Config**: Config to fetch the dbt files from s3.
2. **dbt GCS Config**: Config to fetch the dbt files from gcs.
$$

$$section
###dbt Local Config $(id="dbtLocalConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from the local system or in the OpenMetadata container.
$$

$$section
#### dbt Catalog File Path $(id="dbtCatalogFilePath")

Provide the full file path of the dbt catalog.json file. It will be of the type `/root/folder/catalog.json`.
This is an optional file, if not provided catalog.json metadata will not be imported.
$$

$$section
#### dbt Manifest File Path $(id="dbtManifestFilePath")

Provide the full file path of the dbt manifest.json file. It will be of the type `/root/folder/manifest.json`.
This is a mandatory file for dbt ingestion.
$$

$$section
#### dbt Run Results File Path $(id="dbtRunResultsFilePath")

Provide the full file path of the dbt run_results.json file. It will be of the type `/root/folder/run_results.json`.
This is an optional file, if not provided dbt tests and test results will not be imported.
$$

************************************************************************************************************************

$$section
###dbt HTTP Config $(id="dbtHttpConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from http or file server.

If your files are available on github on a public repository, you can pass the raw url of the file which is of the format `https://raw.githubusercontent.com/dbtfiles/master/manifest.json`
$$

$$section
#### dbt Catalog Http Path $(id="dbtCatalogHttpPath")

Provide the full http path of the dbt catalog.json file. It will be of the type `https://localhost/files/catalog.json`.
This is an optional file, if not provided catalog.json metadata will not be imported.
$$

$$section
#### dbt Manifest Http Path $(id="dbtManifestHttpPath")

Provide the full http path of the dbt manifest.json file. It will be of the type `https://localhost/files/manifest.json`.
This is a mandatory file for dbt ingestion.
$$

$$section
#### dbt Run Results Http Path $(id="dbtRunResultsHttpPath")

Provide the full http path of the dbt run_results.json file. It will be of the type `https://localhost/files/run_results.json`.
This is an optional file, if not provided dbt tests and test results will not be imported
$$

************************************************************************************************************************

$$section
###dbt Cloud Config $(id="dbtCloudConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from dbt cloud APIs.
$$

$$section
#### dbt Cloud Account Id $(id="dbtCloudAccountId")

To obtain your dbt Cloud account ID, sign into dbt Cloud in your browser. Take note of the number directly following the accounts path component of the URL -- this is your account ID. For example, if the URL is `https://cloud.getdbt.com/#/accounts/1234/projects/6789/dashboard/`, the account ID is `1234`.
$$

$$section
#### dbt Cloud Authentication Token $(id="dbtCloudAuthToken")

Please follow the instructions in [dbt Cloud's API](https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens) documentation to create a dbt Cloud API token.
$$

$$section
#### dbt Cloud Project Id $(id="dbtCloudProjectId")

In case of multiple projects in a dbt cloud account, specify the project's id from which you want to extract the dbt run artifacts.
If left empty the dbt artifacts will fetched from the most recent run on dbt cloud.
$$

$$section
#### dbt Cloud Job Id $(id="dbtCloudJobId")

In case of multiple jobs in a dbt cloud account, specify the job's id from which you want to extract the dbt run artifacts.
If left empty the dbt artifacts will fetched from the most recent run on dbt cloud.
$$

$$section
#### dbt Cloud URL $(id="dbtCloudUrl")

URL to connect to your dbt cloud instance. E.g., `https://cloud.getdbt.com` or `https://emea.dbt.com/`.
$$

************************************************************************************************************************

$$section
###dbt S3 Config $(id="dbtS3Config")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from s3 bucket
$$

$$section
### Aws Access Key Id $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have 
permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: 
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
$$

$$section
### Aws Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### Aws Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.
You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).
$$

$$section
### Aws Session Token $(id="awsSessionToken")

AWS Session Token.
If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).
$$

$$section
### End Point URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the 
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the 
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).
$$

$$section
### dbt Bucket Name $(id="dbtBucketName")

Name of the bucket where the dbt files are stored.

For Example, if the S3 URL is `s3://bucket-name/main-dir/dbt-files/` enter `bucket-name` in the field.
$$

$$section
### dbt Object Prefix $(id="dbtObjectPrefix")

Path of the folder where the dbt files are stored.

For Example, if the S3 URL is `s3://bucket-name/main-dir/dbt-files/` enter `main-dir/dbt-files/` in the field.
$$

************************************************************************************************************************

$$section
###dbt GCS Config $(id="dbtGcsConfig")

In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from the gcs bucket.
$$

$$section
### Gcs Config $(id="gcsConfig")

Pass the path of file containing the GCP service account keys. You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.
$$

$$section
### Project Id $(id="projectId")

A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the "project_id" key in the service account key file.
$$

$$section
### Private Key Id $(id="privateKeyId")

This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the "private_key_id" key in the service account file.
$$

$$section
### Private Key $(id="privateKey")

This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the "private_key" key in the service account file.
$$

$$section
### Client Email $(id="clientEmail")

This is the email address associated with the service account. To fetch this key, look for the value associated with the "client_email" key in the service account key file.
$$

$$section
### Client Id $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the "client_id" key in the service account key  file.
$$

$$section
### Auth Uri $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the "auth_uri" key in the service account key file.
$$

$$section
### Token Uri $(id="tokenUri")

The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization.

To fetch this key, look for the value associated with the "token_uri" key in the service account credentials file.
$$

$$section
### Auth Provider X509Cert URL $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the "auth_provider_x509_cert_url" key in the service account key file.
$$

$$section
### Client X509Cert URL $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the "client_x509_cert_url" key in the service account key  file.
$$

$$section
### dbt Bucket Name $(id="dbtBucketName")

Name of the bucket where the dbt files are stored.

For Example, if the path `bucket-name/main-dir/dbt_files` is where the dbt files are stored, enter `bucket-name` in the field.
$$

$$section
### dbt Object Prefix $(id="dbtObjectPrefix")

Path of the folder where the dbt files are stored.

For Example, if the path `bucket-name/main-dir/dbt_files` is where the dbt files are stored, enter `main-dir/dbt-files` in the field.
$$


$$section
### Enable Debug Logs $(id="loggerLevel")

Enabling debug logs tracks error messages during ingestion for troubleshooting.
$$

$$section
### Update Descriptions $(id="dbtUpdateDescriptions")

This options updates the table and column descriptions in OpenMetadata with descriptions from dbt.

If the option is disabled, only tables and columns without any existing descriptions will have their descriptions updated based on the dbt manifest. 

However, if the option is enabled, descriptions for all tables and columns in the dbt manifest will be updated in OpenMetadata.
$$

$$section
### Include dbt Tags $(id="includeTags")

Option to include fetching the tags metadata from dbt. 
When enabled, OpenMetadata will fetch tags associated with tables and columns from dbt manifest.json and attach them to the corresponding entities in OpenMetadata.
$$

$$section
### dbt Tags Classification Name $(id="dbtClassificationName")

Name of the classification under which the dbt tags will be classified if the `Include dbt Tags` option is enabled.
By default the classification name will be set to `dbtTags`.
$$


