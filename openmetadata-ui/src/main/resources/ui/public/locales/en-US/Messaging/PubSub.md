# Google Cloud Pub/Sub

In this section, we provide guides and references to use the Google Cloud Pub/Sub connector.

## Requirements

The Pub/Sub connector ingests metadata using the Google Cloud Pub/Sub API. The service account must have the following roles:

- `roles/pubsub.viewer` — to list topics, subscriptions, and schemas

You can find further information on creating and managing service account keys in the <a href="https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console" target="_blank">GCP documentation</a>.

You can find further information on the Pub/Sub connector in the <a href="https://docs.open-metadata.org/connectors/messaging/pubsub" target="_blank">docs</a>.

## Connection Details

$$section
### GCP Credentials Configuration $(id="gcpConfig")

You can authenticate with Google Cloud Pub/Sub using either `GCP Credentials Path` where you can specify the file path of the service account key, or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check <a href="https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console" target="_blank">this</a> documentation on how to create the service account keys and download it.

If you want to use <a href="https://cloud.google.com/docs/authentication#adc" target="_blank">ADC authentication</a> for Pub/Sub you can just leave the GCP credentials empty or select `GCP Application Default Credentials`.
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
### Target Service Account Email $(id="impersonateServiceAccount")

The email address of the service account to impersonate. Used when you want to access Pub/Sub resources using a different service account than the one providing credentials.
$$

$$section
### Lifetime $(id="lifetime")

Number of seconds the delegated credential should be valid. Defaults to 3600 (1 hour).
$$

$$section
### GCP Project ID $(id="projectId")

The GCP Project ID where your Pub/Sub topics are located. If not specified, the project ID will be read from the GCP credentials configuration.
$$

$$section
### Host and Port $(id="hostPort")

The Pub/Sub API endpoint URL. Defaults to `pubsub.googleapis.com` for the production Google Cloud service.

For local testing with the Pub/Sub emulator, set this to the emulator address (e.g. `localhost:8085`) and enable the **Use Emulator** toggle.
$$

$$section
### Use Emulator $(id="useEmulator")

Enable this option to connect to a local Pub/Sub emulator instead of the production Google Cloud service. When enabled, the connector sets the `PUBSUB_EMULATOR_HOST` environment variable and skips GCP credential validation.

Requires **Host and Port** to be set to the emulator address (e.g. `localhost:8085`).
$$

$$section
### Enable Schema Registry $(id="schemaRegistryEnabled")

Enable fetching schema definitions from the Pub/Sub Schema Registry. When enabled, the connector will retrieve Avro or Protobuf schema definitions associated with each topic and parse them into OpenMetadata field definitions.

$$note
Schema Registry is not supported when using the Pub/Sub emulator.
$$
$$

$$section
### Include Subscriptions $(id="includeSubscriptions")

Include subscription metadata for each topic. When enabled, subscription details such as acknowledgement deadline, message retention duration, push endpoint, dead letter topic, and filter expressions are stored in the topic's configuration.
$$

$$section
### Include Dead Letter Topics $(id="includeDeadLetterTopics")

Include dead letter topics in metadata extraction. By default, dead letter topics are excluded to keep the topic list focused on primary data streams.
$$

$$section
### Topic Filter Pattern $(id="topicFilterPattern")

Topic filter patterns are used to control whether to include Topics as part of metadata ingestion.

**Include**: Explicitly include Topics by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Topics with names matching one or more of the supplied regular expressions. All other Topics will be excluded.

For example, to include only those Topics whose name starts with the word `orders`, add the regex pattern in the include field as `^orders.*`.

**Exclude**: Explicitly exclude Topics by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Topics with names matching one or more of the supplied regular expressions. All other Topics will be included.

For example, to exclude all Topics with the name containing the word `test`, add regex pattern in the exclude field as `.*test.*`.

Checkout <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern" target="_blank">this</a> document for further examples on filter patterns.
$$