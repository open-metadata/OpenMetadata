# Data Lake

In this section, we provide guides and references to use the Data Lake connector.

## Requirements

The Data Lake connector supports extracting metadata from the following formats `JSON`, `CSV`, `TSV`, `Parquet` & `Avro`.

### S3 Permissions

To execute metadata extraction AWS account should have enough access to fetch required data. The **Bucket Policy** in AWS requires at least these permissions:

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
        "arn:aws:s3:::bucketName",
        "arn:aws:s3:::bucketName/*"
      ]
    }
  ]
}
```

### GCP Permissions

To execute metadata extraction GCP account should have enough access to fetch required data. The **Bucket Policy** requires at least these permissions:

- `storage.buckets.get`
- `storage.buckets.list`
- `storage.objects.get`
- `storage.objects.list`

You can find further information on the Data Lake connector in the <a href="https://docs.open-metadata.org/connectors/database/datalake" target="_blank">docs</a>.

## Connection Details

$$section
### Config Source $(id="configSource")
For configuring your Data Lake Connection, you have three options to choose from:

- **AzureConfig**: Azure Blob Storage provides a fully managed, highly scalable, and secure cloud storage service with advanced data management features, integrated analytics tools, and flexible pricing options to meet the needs of any Data Lake solution.
- **GCSConfig**: Google Cloud Storage provides a highly scalable and fully-managed object storage service with advanced security features, global availability, and a user-friendly interface for storing and processing large amounts of data.
- **S3Config**: Amazon S3 offers a highly available, durable, and secure object storage service with advanced management features, powerful analytics capabilities, and seamless integration with other AWS services.
$$

$$section
### Security Config $(id="securityConfig")
$$

$$section
### Client ID $(id="clientId")

#### Azure

To get the Client ID (also known as application ID), follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. From the Overview section, copy the `Application (client) ID`.

#### GCS

To find the GCS service account Client ID from a service account file, you can open the JSON file and look for the `client_id` field. Here are the steps:

1. Open the JSON file for the GCP service account in a text editor or IDE.
2. Look for the `client_id` field, which should be listed under the `private_key` object.
3. The value of the `client_id` field is the GCP service account Client ID.

$$

## Azure

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.

$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Account Name $(id="accountName")

Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.
$$

## GCS

$$section
### GCP Credentials Configuration $(id="gcsConfig")
- **GCS credentials value**: Users can choose to pass their Google Cloud Storage (GCS) credentials as a JSON object. This approach involves directly including the credentials in the code or environment variable.
- **GCS Credentials Path**: Users can choose to pass the path of their GCS credentials file. This approach involves storing the credentials in a file, and providing the path to the file in the code or environment variable.
$$


$$section
### Credentials Type $(id="type")
The account type will be set to `service_account` by default. This means that the account can be used to authenticate and authorize access to various Google Cloud services and resources, using its own unique credentials.
$$

$$section
### Project ID $(id="projectId")
This is the ID of the project associated with the service account. To fetch this key, look for the value associated with the `project_id` key in the service account file.

- **Single Project ID**: Fetch Resources from Single Bigquery/GCP Project ID
- **Mutiple Project IDs**: Fetch Resources from Multiple Bigquery/GCP Project ID

#### Find your Project ID

1. Log in to the Google Cloud Console at <a href="https://console.cloud.google.com/" target="_blank">https://console.cloud.google.com/</a>.
2. Select your project from the project dropdown menu at the top of the page.
3. The project ID is displayed at the top of the console dashboard, just below the project name.
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

## AWS S3

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests (<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html" target="_blank">docs</a>).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" target="_blank">here</a>
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">docs</a>).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">here</a>.
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Using temporary credentials with AWS resources</a>.
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS service endpoints</a>.
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Named profiles for the AWS CLI</a>.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.
$$

$$section
### Bucket Name $(id="bucketName")

A bucket name in Data Lake is a unique identifier used to organize and store data objects.

It's similar to a folder name, but it's used for object storage rather than file storage.
$$

$$section
### Prefix $(id="prefix")

The prefix of a data source refers to the first part of the data path that identifies the source or origin of the data.

It's used to organize and categorize data within the container, and can help users easily locate and access the data they need.
$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of the Data Lake, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$
