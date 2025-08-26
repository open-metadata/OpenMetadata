# BigTable

In this section, we provide guides and references to use the BigTable connector.

## Requirements

We need to enable the BigTable API and use an account with a specific set of minimum permissions:

### BigTable API Permissions

Click on `Enable API`, which will enable the APs on the selected project:

- <a href="https://console.cloud.google.com/apis/api/bigtableadmin.googleapis.com" target="_blank">Cloud Bigtable Admin API</a>
- <a href="https://console.cloud.google.com/apis/library/bigtable.googleapis.com" target="_blank">Cloud Bigtable API</a>

### GCP Permissions

To execute the metadata extraction and Usage workflow successfully, the user or the service account should have enough permissions to fetch required data:

- `bigtable.instances.get`
- `bigtable.instances.list`
- `bigtable.tables.get`
- `bigtable.tables.list`
- `bigtable.tables.readRows` 

You can visit <a href="https://docs.open-metadata.org/connectors/database/bigtable/roles" target="_blank">this</a> documentation on how you can create a custom role in GCP and assign the above permissions to the role & service account!

You can find further information on the BigTable connector in the <a href="https://docs.open-metadata.org/connectors/database/bigtable" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Host Port $(id="hostPort")

BigQuery APIs URL. By default, the API URL is `bigquery.googleapis.com`. You can modify this if you have custom implementation of BigQuery.
$$

$$section
### GCP Credentials Configuration $(id="gcpConfig")

You can authenticate with your BigQuery instance using either `GCP Credentials Path` where you can specify the file path of the service account key, or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check <a href="https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console" target="_blank">this</a> documentation on how to create the service account keys and download it.

If you want to use <a href="https://cloud.google.com/docs/authentication#adc" target="_blank">ADC authentication</a> for BigQuery you can just leave the GCP credentials empty.

$$

$$section
### Credentials Type $(id="type")

Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
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

Make sure you are passing the key in a correct format. If your private key looks like this:

```
-----BEGIN ENCRYPTED PRIVATE KEY-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END ENCRYPTED PRIVATE KEY-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END ENCRYPTED PRIVATE KEY-----\n
```
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

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
