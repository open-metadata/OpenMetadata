# Google Sheets

In this section, we provide guides and references to use the Google Sheets connector.

## Requirements

We need to enable the required Google APIs and use an account with specific permissions to access Google Sheets and Google Drive:

### Required Google APIs

To connect to Google Sheets, you need to enable the following APIs in your Google Cloud Project:

- **Google Sheets API**: Go to [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com) page, select your GCP Project ID, and click "Enable API".
- **Google Drive API**: Go to [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) page, select your GCP Project ID, and click "Enable API".

### GCP Permissions

To execute the metadata extraction workflow successfully, the service account should have the following permissions:

**Required for Google Sheets API:**
- Read access to Google Sheets files
- Access to spreadsheet metadata and structure

**Required for Google Drive API:**
- `drive.files.list` - To list available spreadsheet files
- `drive.files.get` - To get file metadata
- `drive.about.get` - To verify authentication

### OAuth Scopes

The following OAuth scopes are required (these are set by default):
- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read-only access to Google Sheets
- `https://www.googleapis.com/auth/drive.readonly` - Read-only access to Google Drive files

$$note
The service account must have access to the Google Sheets you want to extract metadata from. You can share sheets with the service account email address, or the sheets must be accessible through shared drives if `includeSharedDrives` is enabled.
$$

You can find further information on the Google Sheets connector in the [docs](https://docs.open-metadata.org/connectors/database/googlesheets).

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. The default value is `googlesheets`.
$$

$$section
### Database Name $(id="databaseName")
Optional name to give to the database in OpenMetadata. If left blank, we will use 'default'.
$$

$$section
### GCP Credentials Configuration $(id="gcpConfig")

You can authenticate with Google Sheets using either `GCP Credentials Path` where you can specify the file path of the service account key, or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for Google Sheets you can just leave the GCP credentials empty.

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
-----BEGIN PRIVATE KEY-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END PRIVATE KEY-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN PRIVATE KEY-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END PRIVATE KEY-----\n
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
### OAuth Scopes $(id="scopes")
Google Sheets API scopes that define the level of access requested. The default scopes are:
- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read-only access to Google Sheets
- `https://www.googleapis.com/auth/drive.readonly` - Read-only access to Google Drive files

You can modify these scopes if you need different levels of access.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")
Regex pattern to include/exclude schemas that match the pattern. In the context of Google Sheets, this helps you selectively process spreadsheets based on their organization.

Examples:
- `.*sales.*` - Include schemas with "sales" in the name
- `^(?!temp).*` - Exclude schemas starting with "temp"
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")
Regex pattern to include/exclude tables that match the pattern. In the context of Google Sheets, this allows you to selectively process specific sheets within spreadsheets.

Examples:
- `.*report.*` - Include sheets with "report" in the name
- `^(?!draft).*` - Exclude sheets starting with "draft"
$$

$$section
### Include Shared Drives $(id="includeSharedDrives")
Enable this option to include sheets from Google Workspace shared drives (Team Drives). When enabled, OpenMetadata will scan shared drives that the service account has access to, in addition to regular Google Drive files.

Default: `true`
$$

$$section
### Target Service Account Email $(id="impersonateServiceAccount")
The impersonated service account email. This allows the authenticated service account to impersonate another service account for accessing Google Sheets.
$$

$$section
### Lifetime $(id="lifetime")
Number of seconds the delegated credential should be valid when using service account impersonation.
$$

$$section
### Audience $(id="audience")
Google Security Token Service audience which contains the resource name for the workload identity pool and the provider identifier in that pool.
$$

$$section
### Subject Token Type $(id="subjectTokenType")
Google Security Token Service subject token type based on the OAuth 2.0 token exchange spec.
$$

$$section
### Token URL $(id="tokenURL")
Google Security Token Service token exchange endpoint.
$$

$$section
### Credential Source $(id="credentialSource")
This object defines the mechanism used to retrieve the external credential from the local environment so that it can be exchanged for a GCP access token via the STS endpoint.
$$
