#### Connection Details

- **Username**: Specify the User to connect to Greenplum. It should have enough privileges to read all the metadata.
- **Auth Type**: Basic Auth or IAM based auth to connect to instances / cloud rds.
  - **Basic Auth**: 
    - **Password**: Password to connect to Greenplum
  - **IAM Based Auth**: 
    {% partial file="/v1.6/connectors/database/aws.md" /%}

- **Host and Port**: Enter the fully qualified hostname and port number for your Greenplum deployment in the Host and Port field.


**SSL Modes**

There are a couple of types of SSL modes that Greenplum supports which can be added to ConnectionArguments, they are as follows:
- **disable**: SSL is disabled and the connection is not encrypted.
- **allow**: SSL is used if the server requires it.
- **prefer**: SSL is used if the server supports it.
- **require**: SSL is required.
- **verify-ca**: SSL must be used and the server certificate must be verified.
- **verify-full**: SSL must be used. The server certificate must be verified, and the server hostname must match the hostname attribute on the certificate.

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under sslConfig which is placed in the source.