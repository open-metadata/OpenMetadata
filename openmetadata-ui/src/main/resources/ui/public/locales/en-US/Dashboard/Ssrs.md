# SSRS

In this section, we provide guides and references to use the SQL Server Reporting Services (SSRS) connector.

## Requirements

To access the SSRS REST API and import reports from SQL Server Reporting Services into OpenMetadata, you need a service account with appropriate permissions on your SSRS instance.

- The user must have at least **Browser** role on the SSRS portal to list reports and folders.
- **Content Manager** role is recommended for full metadata extraction including data sources.
- SSRS REST API v2.0 must be enabled on the report server (available in SSRS 2017 and later).

You can find further information on the SSRS connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/ssrs" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

The base URL of your SSRS Report Server instance.
$$

$$section
### Username $(id="username")

Username to connect to SSRS. This should be a Windows domain account or a local account with sufficient permissions on the report server.

**Format:** `DOMAIN\username` for domain accounts, or just `username` for local accounts.
$$

$$section
### Password $(id="password")

Password of the user account used to connect to SSRS.
$$

$$section
### Verify SSL $(id="verifySSL")

Enable or disable SSL certificate verification when connecting to SSRS.

Possible values:
- `validate`: Validate the certificate using the public certificate (recommended for production).
- `ignore`: Ignore certificate validation (use only for development/testing).
- `no-ssl`: SSL validation is not needed (default, for HTTP connections).
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL configuration in case you are connecting to an SSRS instance with SSL enabled.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation.
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication.
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate.
$$
