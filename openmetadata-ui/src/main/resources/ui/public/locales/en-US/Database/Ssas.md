# Ssas

In this section, we provide guides and references to use the Ssas connector.

## Requirements
To use the SSAS connector, ensure that your SSAS instance is accessible via HTTP (XMLA endpoint) and that HTTP access is enabled.

- The HTTP endpoint must support **Basic Authentication** using a username and password.
- The user account provided must have sufficient privileges/permissions to extract metadata from SSAS (such as access to read database, tables, and schema information).
- The SSAS models you want to extract metadata from must be deployed and accessible over HTTP (XMLA endpoint).
- The endpoint should be reachable from the OpenMetadata server.

If you are unsure about your permissions, contact your SSAS administrator to confirm that your account can access and read metadata via the XMLA endpoint.


## Connection Details

$$section
### HTTP Connection URL $(id="httpConnection")
URL to your SSAS XMLA endpoint. OpenMetadata will connect to this endpoint to extract metadata.
An example endpoint is `http://<your-server>/olap/msmdpump.dll`.
$$

$$section
### Username $(id="username")
Username to connect to SSAS. This user should have privileges to read all the metadata from the SSAS instance.
$$

$$section
### Password $(id="password")
Password to connect to SSAS.
$$
