# Apache Ranger

In this section, we provide guides and references to use the Apache Ranger Security Service connector.

## Requirements

Apache Ranger is a centralized security administration solution that provides comprehensive security for data stored in Apache Hadoop clusters. OpenMetadata can connect to Apache Ranger for the reverse metadata.

### Apache Ranger Prerequisites

To successfully connect to Apache Ranger, ensure the following prerequisites are met:

- Apache Ranger should be properly installed and configured in your environment
- The Ranger Admin service should be running and accessible
- You should have administrative access to Ranger or at least read permissions for policies
- Network connectivity should be established between OpenMetadata and Ranger Admin URL

### Authentication Requirements

Apache Ranger connector supports two authentication methods:

#### Basic Authentication
- **Username**: A user account with sufficient privileges to read policies and metadata
- **Password**: The password for the specified user account
- The user should have permissions to access Ranger Admin APIs

#### Kerberos Authentication  
- **Keytab Path**: Path to the keytab file for authentication
- **Principal**: Kerberos principal name (e.g., `ranger@EXAMPLE.COM`)
- Proper Kerberos configuration should be in place on the OpenMetadata server

### Required Permissions

The user account used for connection should have the following minimum permissions:

- Read access to all policies across services
- Access to Ranger Admin REST APIs
- Permissions to list and view service definitions
- Access to user and group information (if available)

For more detailed information on setting up the appropriate permissions, refer to the [Apache Ranger documentation](https://ranger.apache.org/).

## Connection Details

$$section
### Host and Port $(id="hostPort")

Apache Ranger Admin URL. This should be the complete URL including protocol (http/https) and port.

Example: `https://localhost:6080`
$$

$$section
### Authentication Type $(id="authType")

Choose the authentication method to connect to Apache Ranger:

- **Basic Auth**: Username and password authentication
- **Kerberos Auth**: Kerberos-based authentication using keytab and principal
$$

$$section
### Username $(id="username")
*Available when Basic Auth is selected*

Username to connect to Apache Ranger. This user should have privileges to read all policies and metadata in Ranger.
$$

$$section
### Password $(id="password")
*Available when Basic Auth is selected*

Password to connect to Apache Ranger.
$$

$$section
### Keytab Path $(id="keytabPath")
*Available when Kerberos Auth is selected*

Path to the keytab file for Kerberos authentication. The keytab file should be accessible from the OpenMetadata server.
$$

$$section
### Principal $(id="principal")
*Available when Kerberos Auth is selected*

Kerberos principal for authentication. Used with keytab file.

Example: `ranger@EXAMPLE.COM`
$$

## Metadata Ingestion

The Apache Ranger Security Service connector does not extract any metadata from the source; it is intended solely for reverse metadata operations.
