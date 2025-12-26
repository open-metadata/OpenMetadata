# OpenSearch

In this section, we provide guides and references to use the OpenSearch connector. You can view the full documentation for OpenSearch <a href="https://docs.open-metadata.org/connectors/search/opensearch" target="_blank">here</a>.

## Requirements

We extract OpenSearch's metadata by using its <a href="https://opensearch.org/docs/latest/api-reference/" target="_blank">API</a>. To run this ingestion, you just need a user with permissions to the OpenSearch instance.

You can find further information on the OpenSearch connector in the <a href="https://docs.open-metadata.org/connectors/search/opensearch" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the OpenSearch instance. This should be specified as a string in the format `http://hostname:port`. For example, you might set the hostPort parameter to `http://localhost:9200` or `https://localhost:9200`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `http://host.docker.internal:9200` as the value.
$$


$$section
### Auth Config $(id="authType")
There are 3 types of auth configs:

- Basic Auth.
- IAM based Auth.

User can authenticate the OpenSearch Instance with auth type as `Basic Authentication` i.e. Username and Password **or** by using `IAM based Authentication` to connect to AWS related services.
$$

## Basic Auth

$$section
### Username $(id="username")
Username to connect to OpenSearch required when Basic Authentication is enabled on OpenSearch.
$$

$$section
### Password $(id="password")
Password of the user account to connect with OpenSearch.
$$

## IAM based Auth Config

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
### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabled.

Possible values:
- `validate`: Validate the certificate using the public certificate (recommended).
- `ignore`: Ignore the certification validation (not recommended for production).
- `no-ssl`: SSL validation is not needed.
$$


$$section
### SSL Certificates $(id="certificates")
If you have SSL/TLS enable on for your OpenSearch you will need to pass the relevant SSL certificates in order to communicate with the OpenSearch instance. You can either provide the where these certificates are stored or you can provide the direct value of these certificates.
$$

$$section
### CA Certificate Path $(id="caCertPath")
This field specifies the path of CA certificate required for authentication. 
$$

$$section
### Client Certificate Path $(id="clientCertPath")
This field specifies the path of Clint certificate required for authentication. 
$$


$$section
### Private Key Path $(id="privateKeyPath")
This field specifies the path of Clint Key/Private Key required for authentication. 
$$


$$section
### CA Certificate Value $(id="caCertValue")

This field specifies the value of CA certificate required for authentication.


Make sure you are passing the value of certificate in a correct format. If your certificate looks like this:

```
-----BEGIN CERTIFICATE-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END CERTIFICATE-----
```

You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$

$$section
### Client Certificate Value $(id="clientCertValue")

This field specifies the value of client certificate required for authentication.


Make sure you are passing the value in a correct format. If your certificate looks like this:

```
-----BEGIN CERTIFICATE-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END CERTIFICATE-----
```

You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$


$$section
### Private Key Value $(id="privateKeyValue")

This field specifies the value of private key required for authentication.


Make sure you are passing the key in a correct format. If your certificate looks like this:

```
-----BEGIN RSA PRIVATE KEY-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END RSA PRIVATE KEY-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n
```
$$


$$section
### Staging Directory Path $(id="stagingDir")

This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over. 
$$