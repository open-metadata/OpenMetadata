# Datalake

In this section, we provide guides and references to use the Datalake connector.

## Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV`, `Parquet` & `Avro`.

**S3 Permissions**

<p> To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions: </p>

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
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```

**GCP Permissions / Roles**

<p> To execute metadata extraction GCP account should have enough access to fetch required data. The <strong>Bucket Policy</strong> requires at least these permissions: </p>

- **storage.buckets.get**
- **storage.buckets.list**
- **storage.objects.get**
- **storage.objects.list**

`storage.objects.list`: This permission is needed to list the objects in a bucket.

`storage.objects.get`: This permission is needed to read the contents of an object in a bucket.

`storage.buckets.get`: This permission is needed to get information about a bucket, such as its location and storage class.

`storage.buckets.list`: This permission is needed to list the buckets in a project.

## Connection Details


$$section
### Config Source $(id="configSource")
For configuring your DataLake, you have three options to choose from based on your preferences and requirements:

**AzureConfig**: Azure Blob Storage provides a fully managed, highly scalable, and secure cloud storage service with advanced data management features, integrated analytics tools, and flexible pricing options to meet the needs of any DataLake solution.

**GCSConfig**: Google Cloud Storage provides a highly scalable and fully-managed object storage service with advanced security features, global availability, and a user-friendly interface for storing and processing large amounts of data.

**S3Config**: Amazon S3 offers a highly available, durable, and secure object storage service with advanced management features, powerful analytics capabilities, and seamless integration with other AWS services.
$$

$$section
### Security Config $(id="securityConfig")
$$

$$section
### Client ID $(id="clientId")

#### Azure

To get the client ID (also know as application ID), follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).

2. Search for App registrations and select the App registrations link.

3. Select the Azure AD app you're using for embedding your Power BI content.

4. From the Overview section, copy the Application (client) ID.

#### GCS

To find the GCS service account client ID from a service account file, you can open the JSON file and look for the `client_id` field. Here are the steps:

1. Open the JSON file for the GCS service account in a text editor or IDE.

2. Look for the `client_id` field, which should be listed under the `private_key` object.

3. The value of the `client_id` field is the GCS service account client ID.

$$

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).

2. Search for App registrations and select the App registrations link.

3. Select the Azure AD app you're using for embedding your Power BI content.

4. Under Manage, select Certificates & secrets.

5. Under Client secrets, select New client secret.

6. In the Add a client secret pop-up window, provide a description for your application secret, select when the application secret expires, and select Add.

7. From the Client secrets section, copy the string in the Value column of the newly created application secret.

$$

$$section
### Tenant Id $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).

2. Search for App registrations and select the App registrations link.

3. Select the Azure AD app you're using for Power BI.

4. From the Overview section, copy the Directory (tenant) ID.
$$

$$section
### Account Name $(id="accountName")

Here are the step-by-step instructions for finding the account name for an Azure DataLake Storage account:

1. Sign in to the Azure portal and navigate to the "Storage accounts" page.

2. Find the DataLake Storage account you want to access and click on its name.

3. In the account overview page, locate the "Account name" field. This is the unique identifier for the DataLake Storage account.

4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.

5. Note down the account name for future reference or copy it to your clipboard for use in other tools or applications.
$$

$$section
### Bucket Name $(id="bucketName")

A bucket name in DataLake is a unique identifier used to organize and store data objects.
It's similar to a folder name, but it's used for object storage rather than file storage.
$$

$$section
### Prefix $(id="prefix")

The prefix of a data source in datalake refers to the first part of the data path that identifies the source or origin of the data. It's used to organize and categorize data within the datalake, and can help users easily locate and access the data they need.
$$

$$section
### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
$$

$$section
### GCS Credentials Configuration $(id="gcsConfig")
**GCS credentials value**: Users can choose to pass their Google Cloud Storage (GCS) credentials as a JSON object. This approach involves directly including the credentials in the code or environment variable, which can be risky if the code is public or the environment is not secure.

**GCS Credentials Path**: Users can choose to pass the path of their GCS credentials file. This approach involves storing the credentials in a file, and providing the path to the file in the code or environment variable. This is a more secure approach, as the credentials are not directly visible in the code or environment.
$$


$$section
### Credentials Type $(id="type")
The account type will be set to `service_account` by default. This means that the account can be used to authenticate and authorize access to various Google Cloud services and resources, using its own unique credentials.
$$

$$section
### Project Id $(id="projectId")
This is the ID of the project associated with the service account. To fetch this key, look for the value associated with the "project_id" key in the service account file.
**Single Project ID**
Fetch Resources from Single Bigquery/GCP Project ID

**Mutiple Project IDs**
Fetch Resources from Multiple Bigquery/GCP Project ID

#### Find your Project ID

**Google Cloud Console:**

Log in to the Google Cloud Console at [https://console.cloud.google.com/](https://console.cloud.google.com/).

Select your project from the project dropdown menu at the top of the page.

The project ID is displayed at the top of the console dashboard, just below the project name.
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

This is the email address associated with the service account. To fetch this key, look for the value associated with the "client_email" key in the service account file.
$$

$$section
### Auth Uri $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the "auth_uri" key in the service account file.
$$

$$section
### Token Uri $(id="tokenUri")

This is the URI for the token server. To fetch this key, look for the value associated with the "token_uri" key in the service account file.
$$

$$section
### Auth Provider X509Cert Url $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the "auth_provider_x509_cert_url" key in the service account file.
$$

$$section
### Client X509Cert Url $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the "client_x509_cert_url" key in the service account file.
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
### AWS Secret Access Key $(id="awsSecretAccessKey")

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
### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.
You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the 
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the 
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to a AWS CLI command. 
When you specify a profile to run a command, the settings and credentials are used to run that command. 
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.  

A user who wants to access a role in a different account must also have permissions that are delegated from the account 
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->
$$