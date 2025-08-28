# Nifi
In this section, we provide guides and references to use the Nifi connector.

## Requirements
OpenMetadata supports 2 types of connection for the Nifi connector:
- **Basic Authentication**: use username/password to authenticate to Nifi. 
- **Client Certificate Authentication**: use CA, client certificate and client key files to authenticate

You can find further information on the Nifi connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/nifi" target="_blank">docs</a>.

## Connection Details
$$section
### Host and Port $(id="hostPort")
Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8443`, `http://host.docker.internal:8443`.
$$

$$section
### Nifi Config $(id="nifiConfig")
OpenMetadata supports basic authentication (username/password) or client certificate authentication. See requirement section for more details.
$$

$$section
### Username $(id="username")
Username to connect to Nifi. This user should be able to send request to the Nifi API and access the `Resources` endpoint.
$$

$$section
### Password $(id="password")
Password to connect to Nifi.
$$

$$section
### Verify SSL $(id="verifySSL")
Whether SSL verification should be performed when authenticating.
$$

$$section
### Certificate Authority Path $(id="certificateAuthorityPath")
Path to the certificate authority (CA) file. This is the certificate used to store and issue your digital certificate. This is an optional parameter. If omitted SSL verification will be skipped; this can present some sever security issue.

**Important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$

$$section
### Client Certificate Path $(id="clientCertificatePath")
Path to the certificate client file.

**Important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$

$$section
### Client Key Path $(id="clientkeyPath")
Path to the client key file.

**Important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$
