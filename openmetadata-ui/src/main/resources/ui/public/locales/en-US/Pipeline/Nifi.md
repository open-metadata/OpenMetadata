# Nifi
In this section, we provide guides and references to use the Nifi connector. You can view the full documentation for Nifi [here](https://docs.open-metadata.org/connectors/pipeline/nifi).

## Requirements
OpenMetadata supports 2 types of connection for the Nifi connector:
- **basic authentication**: use username/password to authenticate to Nifi. 
- **client certificate authentication**: use CA, client certificate and client key files to authenticate

## Connection Details
$$section
### Host Port $(id="hostPort")
Pipeline Service Management/UI URI. This should be specified as a string in the format 'hostname:port'.
**Example**: `localhost:8443`, `host.docker.internal:8443`
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
Whether SSL verification should be perform when authenticating.
$$

$$section
### Certificate Authority Path $(id="certificateAuthorityPath")
Path to the certificate authority (CA) file. This is the certificate used to store and issue your digital certificate. This is an optional parameter. If omitted SSL verification will be skipped; this can present some sever security issue.
**important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$

$$section
### Client Certificate Path $(id="clientCertificatePath")
Path to the certificate client file.
**important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$

$$section
### Client Key Path $(id="clientkeyPath")
Path to the client key file.
**important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
$$