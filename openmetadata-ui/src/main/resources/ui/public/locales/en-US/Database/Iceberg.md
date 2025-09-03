# Iceberg

In this section, we provide guides and references to use the Iceberg connector.

## Requirements

The requirements actually depend on the Catalog and the FileSystem used. In a nutshell, the used credentials must have access to reading the Catalog and the Metadata File.

### Glue Catalog

Must have `glue:GetDatabases`, and `glue:GetTables` permissions to be able to read the Catalog.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### DynamoDB Catalog

Must have `dynamodb:DescribeTable` and `dynamodb:GetItem` permissions on the Iceberg Catalog table.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### Hive / REST Catalog
It depends on where and how the Hive / Rest Catalog is setup and where the Iceberg files are stored.

## Catalog Details

$$section
### Name $(id="name")
Catalog name of choice. It can be the name that you prefer and it will appear as such on the UI.

$$

$$section

### Table Name $(id="tableName")

#### DynamoDB Catalog

When using DynamoDB as the Catalog we must point to the correct table where the Iceberg Catalog is stored. This is what the field is all about.
If it isn't set, the default value will be 'iceberg'.

$$
$$section

### URI $(id="uri")

#### Hive Catalog

URI to the Hive Metastore. **It only supports the thrift protocol**

Example: 'thrift://localhost:9083'

#### REST Catalog

URI to the REST Catalog.

Example: 'http://localhost:8181'

$$
$$section

### Client ID $(id="clientId")

#### REST Catalog

OAuth2 Client ID to use for the Authentication Flow

#### Azure File System

To get the Client ID (also known as application ID), follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. From the Overview section, copy the `Application (client) ID`.

$$
$$section

### Client Secret $(id="clientSecret")

#### REST Catalog

OAuth2 Client Secret to use for the Authentication Flow

#### Azure File System

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

### Token $(id="token")

#### REST Catalog
Token used to pass as 'Bearer TOKEN' on the 'Authorization' header.

$$
$$section

### CA Certificate Path  $(id="caCertPath")
#### REST Catalog
If using SSL, the Path to the CA Certificate.

$$
$$section

### Client Certificate  Path  $(id="clientCertPath")
#### REST Catalog
If using SSL, the Path to the Client Certificate.

$$
$$section
### Private Key Path  $(id="privateKeyPath")

#### REST Catalog
If using SSL, the Path to the Private Key.

$$
$$section

### Signing Region $(id="signingRegion")

#### REST Catalog
The AWS Region, If using the AWS Sigv4 for signing requests.

For Example: 'us-east-1'

$$
$$section

### Signing Name $(id="signingName")

#### REST Catalog
The name to sign the requests with, If using the AWS Sigv4 for signing requests.

$$

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

**NOT SUPPORTED**

$$
$$section

### Profile Name $(id="profileName")

**NOT SUPPORTED**

$$
$$section

### Assume Role ARN $(id="assumeRoleArn")

**NOT SUPPORTED**

$$
$$section

### Assume Role Session Name $(id="assumeRoleSessionName")

**NOT SUPPORTED**

$$
$$section

### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

**NOT SUPPORTED**

$$


$$section

### Tenant ID $(id="tentantId")

#### Azure File System

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.

$$
$$section

### Account Name $(id="accountName")

#### Azure File System
Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.

$$

$$section

### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service -> Database -> Schema -> Table
```

In the case of Iceberg, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

$$
$$section
## Ownership Property $(id="ownershipProperty")

Iceberg Tables can store 'Properties' as `key:value` pairs. This defines which property to look for ownership.
As a default it looks for the 'owner' property.

**In order to be able to match the owner of a table with the OpenMetadata data, it must match the e-mail of a registered user or group**

$$

$$section
## Warehouse Location $(id="warehouseLocation")

Used to speciify a custom warehouse location if needed.

Most Catalogs should have a working default, so it normally is not needed. In case you have a custom location only.

$$

