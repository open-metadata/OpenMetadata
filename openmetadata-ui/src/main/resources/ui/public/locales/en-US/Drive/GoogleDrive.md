# Google Drive

In this section, we provide guides and references to use the Google Drive connector.

The Google Drive connector enables you to extract metadata from Google Drive, including files, folders, and shared drives. You can configure it to extract specific types of files such as Google Sheets for detailed data profiling.

## Requirements

To extract metadata from Google Drive, you'll need to set up a service account with appropriate permissions:

### Google Drive API Permissions

To extract metadata from Google Drive, you will need a **Service Account** with the following:
- Google Drive API enabled
- Domain-wide delegation (for accessing organization-wide drives)
- Appropriate OAuth2 scopes:
  - `https://www.googleapis.com/auth/drive.readonly`
  - `https://www.googleapis.com/auth/drive.metadata.readonly`
  - `https://www.googleapis.com/auth/spreadsheets.readonly` (if processing Google Sheets)

## Connection Details

$$section
### GCP Credentials Configuration $(id="gcpConfig")

You can authenticate using either `GCP Credentials Path` where you can specify the file path of the service account key, or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check <a href="https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console" target="_blank">this</a> documentation on how to create the service account keys and download it.

If you want to use <a href="https://cloud.google.com/docs/authentication#adc" target="_blank">ADC authentication</a> you can just leave the GCP credentials empty.

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
### Delegated Email $(id="delegatedEmail")

Email address to impersonate using domain-wide delegation. This allows the service account to access files and folders on behalf of a specific user in your organization.
$$

$$section
### Drive ID $(id="driveId")

Specify a particular shared drive ID to limit metadata extraction to that specific drive. Leave empty to scan all drives accessible to the service account.
$$

$$section
### Include Team Drives $(id="includeTeamDrives")

Controls whether to include shared/team drives in metadata extraction. Enabled by default.
$$

$$section
### Include Google Sheets $(id="includeGoogleSheets")

Extract metadata for Google Sheets files. When enabled, spreadsheet structure and worksheet information will be cataloged.
$$

$$section
### Directory Filter Pattern $(id="directoryFilterPattern")

Regex to only include/exclude directories that match the pattern.

Examples:
- Include only specific folders: `^(data|reports)$`
- Exclude archive folders: `^(?!archive_).*`
$$

$$section
### File Filter Pattern $(id="fileFilterPattern")

Regex to only include/exclude files that match the pattern.

Examples:
- Include only CSV files: `.*\.csv$`
- Exclude temporary files: `^(?!tmp_).*`
$$

$$section
### Spreadsheet Filter Pattern $(id="spreadsheetFilterPattern")

Regex to only include/exclude Google Sheets spreadsheets that match the pattern.

Examples:
- Include only reporting spreadsheets: `^report_.*`
- Exclude draft spreadsheets: `^(?!draft_).*`
$$

$$section
### Worksheet Filter Pattern $(id="worksheetFilterPattern")

Regex to only include/exclude worksheets within Google Sheets that match the pattern.

Examples:
- Include only summary sheets: `^Summary.*`
- Exclude hidden sheets: `^(?!Sheet\d+$).*`
$$

$$section
### Connection Options $(id="connectionOptions")

Optional. Additional connection parameters to customize the Google Drive API client behavior.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Optional. Advanced arguments for fine-tuning the Google Drive API client. Use these for advanced scenarios requiring specific API behaviors.
$$
