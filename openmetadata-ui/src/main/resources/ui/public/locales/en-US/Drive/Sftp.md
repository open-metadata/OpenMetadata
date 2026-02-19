# SFTP

In this section, we provide guides and references to use the SFTP connector.

## Requirements

To extract metadata from an SFTP server, the user needs to have read access to the directories and files to be catalogued.

You can find further information on the SFTP connector in the <a href="https://docs.open-metadata.org/connectors/drive/sftp" target="_blank">docs</a>.

## Connection Details

$$section
### Host $(id="host")
SFTP server hostname or IP address (e.g., `sftp.example.com` or `192.168.1.100`).
$$

$$section
### Port $(id="port")
SFTP server port number. Defaults to `22`.
$$

$$section
### Authentication Type $(id="authType")
Authentication method to connect to the SFTP server. Choose between:
- **Username/Password**: Authenticate using a username and password.
- **Private Key**: Authenticate using an SSH private key in PEM format. Supports RSA, Ed25519, ECDSA, and DSS keys.
$$

$$section
### Username $(id="username")
SFTP username used for authentication.
$$

$$section
### Password $(id="password")
Password for username/password authentication.
$$

$$section
### Private Key $(id="privateKey")
SSH private key content in PEM format for key-based authentication. Supports RSA, Ed25519, ECDSA, and DSS keys.
$$

$$section
### Private Key Passphrase $(id="privateKeyPassphrase")
Passphrase to decrypt the private key, if the key is encrypted. Leave blank if the key has no passphrase.
$$

$$section
### Root Directories $(id="rootDirectories")
List of root directories to scan for files and subdirectories. Defaults to `/` (the user's home directory). Multiple directories can be specified to scope the ingestion to specific paths on the server.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.
$$

$$section
### Directory Filter Pattern $(id="directoryFilterPattern")
Regex to only include/exclude directories that match the pattern.
$$

$$section
### File Filter Pattern $(id="fileFilterPattern")
Regex to only include/exclude files that match the pattern.
$$

$$section
### Structured Data Files Only $(id="structuredDataFilesOnly")
When enabled, only catalog structured data files (CSV, TSV) that can have schema extracted. Non-structured files like images, PDFs, and videos will be skipped. Defaults to `false`.
$$

$$section
### Extract Sample Data $(id="extractSampleData")
When enabled, extract sample data from structured files (CSV, TSV). Disabled by default to avoid performance overhead.
$$
