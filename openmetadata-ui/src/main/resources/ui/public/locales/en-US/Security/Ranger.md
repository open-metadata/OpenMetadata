# Apache Ranger

In this section, we provide guides and references to use the Apache Ranger Security Service connector for reverse metadata ingestion.

## Requirements

Apache Ranger is a centralized security administration solution that provides comprehensive security for data stored in Apache Hadoop clusters. OpenMetadata can connect to Apache Ranger for reverse metadata operations.

### Apache Ranger Prerequisites

To successfully connect to Apache Ranger, ensure the following prerequisites are met:

- Apache Ranger 2.0 or greater is required
- The Ranger Admin service should be running and accessible
- You should have administrative access to Ranger or at least write permissions for policies and tags
- Network connectivity should be established between OpenMetadata and Ranger Admin URL

### Authentication Requirements

Apache Ranger connector supports Basic Authentication:

- **Username**: A user account with sufficient privileges to write policies and tags
- **Password**: The password for the specified user account
- The user should have permissions to access Ranger Admin APIs

### Required Permissions

The user account used for connection should have the following minimum permissions:

**For Reverse Metadata Operations:**
- Write access to tag definitions
- Write access to tag management
- Read access to service definitions for verification

For more detailed information on setting up the appropriate permissions, refer to the <a href="https://ranger.apache.org/" target="_blank">Apache Ranger documentation</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Apache Ranger Admin URL. This should be the complete URL including protocol (http/https) and port.

Example: `https://ranger-admin.example.com:6080`
$$

$$section
### Username $(id="username")

Username to connect to Apache Ranger. This user should have privileges to write policies and tags in Ranger.
$$

$$section
### Password $(id="password")

Password to connect to Apache Ranger.
$$

## Reverse Metadata Ingestion

The Apache Ranger Security Service connector is designed specifically for **reverse metadata ingestion**. This means that OpenMetadata will sync metadata information (primarily tags) from your data sources back to Apache Ranger.

### How Reverse Metadata Works

1. **Configure Ranger as Sink Service**: Set up Apache Ranger as a sink service in your reverse metadata configuration
2. **Source Service Integration**: When you ingest metadata from source services like Snowflake, Trino, or other databases, OpenMetadata can sync this metadata back to Ranger
3. **Tag Synchronization**: Currently, we sync tag information from OpenMetadata to Apache Ranger, allowing you to manage security policies based on discovered metadata
4. **Policy Management**: While we sync tags to Ranger, the communication between Ranger and your specific data sources needs to be configured separately

### Important Considerations

- **Service Name Matching**: The service name configured in Apache Ranger must match exactly with the service name in OpenMetadata for reverse metadata synchronization to work properly
- **Tag Synchronization**: Currently, we only sync tag information to Ranger
- **Source-Ranger Communication**: You are responsible for configuring the communication between Apache Ranger and your actual data sources. OpenMetadata only handles the metadata synchronization to Ranger
- **Bidirectional Sync**: This is currently a one-way sync from OpenMetadata to Ranger

## Troubleshooting

### Connection Issues
- Verify that the Apache Ranger Admin service is running and accessible
- Check network connectivity between OpenMetadata and Apache Ranger
- Ensure the provided credentials have the necessary write permissions for tags and policies

### Authentication Issues
- Verify username and password for basic authentication
- Ensure the user account is active and has proper permissions in Apache Ranger

### Reverse Metadata Issues
- Verify that the service name in Apache Ranger matches exactly with the service name in OpenMetadata
- Check if the user has write permissions for tag and policy management in Ranger
- Ensure that the source service (Trino, etc.) is properly configured in OpenMetadata before setting up reverse metadata

### API Access Issues
- Verify that the user has write access to Apache Ranger APIs for tags and policies
- Check if the Apache Ranger API endpoints are enabled and accessible
- Ensure proper permissions are granted for policy and tag management operations
