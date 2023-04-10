# Datalake

In this section, we provide guides and references to use the Datalake connector.

# Requirements

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

### Config Source $(id="configSource")

Available sources to fetch files.
<!-- configSource to be updated -->

### Security Config $(id="securityConfig")

AWS credentials configs.
<!-- securityConfig to be updated -->

### Client Id $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the "client_id" key in the service account file.

### Client Secret $(id="clientSecret")

Your Service Principal Password (Client Secret)

### Tenant Id $(id="tenantId")

Tenant ID of your Azure App Subscription

### Account Name $(id="accountName")

Account Name of your storage account

### Config Source $(id="configSource")

Available sources to fetch files.
<!-- configSource to be updated -->

### Security Config $(id="securityConfig")

AWS credentials configs.
<!-- securityConfig to be updated -->

### Gcs Config $(id="gcsConfig")

Pass the path of file containing the GCS credentials info

### Project Id $(id="projectId")

 This is the ID of the project associated with the service account. To fetch this key, look for the value associated with the "project_id" key in the service account file.

### Project Id $(id="projectId")

 This is the ID of the project associated with the service account. To fetch this key, look for the value associated with the "project_id" key in the service account file.

### Private Key Id $(id="privateKeyId")

This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the "private_key_id" key in the service account file.

### Private Key $(id="privateKey")

This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the "private_key" key in the service account file.

### Client Email $(id="clientEmail")

This is the email address associated with the service account. To fetch this key, look for the value associated with the "client_email" key in the service account file.

### Client Id $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the "client_id" key in the service account file.

### Auth Uri $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the "auth_uri" key in the service account file.

### Token Uri $(id="tokenUri")

This is the URI for the token server. To fetch this key, look for the value associated with the "token_uri" key in the service account file.

### Auth Provider X509Cert Url $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the "auth_provider_x509_cert_url" key in the service account file.

### Client X509Cert Url $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the "client_x509_cert_url" key in the service account file.

### Gcs Config $(id="gcsConfig")

Pass the path of file containing the GCS credentials info

### Config Source $(id="configSource")

Available sources to fetch files.
<!-- configSource to be updated -->

### Security Config $(id="securityConfig")

AWS credentials configs.
<!-- securityConfig to be updated -->

### Aws Access Key Id $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have 
permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: 
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

### Aws Secret Access Key $(id="awsSecretAccessKey")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have 
permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: 
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

### Aws Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.
You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

### Aws Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

### End Point URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the 
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the 
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to a AWS CLI command. 
When you specify a profile to run a command, the settings and credentials are used to run that command. 
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

### Assume Role Arn $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.  

A user who wants to access a role in a different account must also have permissions that are delegated from the account 
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

### Bucket Name $(id="bucketName")

Bucket Name of the data source.

### Prefix $(id="prefix")

Prefix of the data source.

### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->

### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->

