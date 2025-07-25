---
title: Apache Ranger
slug: /connectors/security/ranger
---

{% connectorDetailsHeader
name="Apache Ranger"
stage="Beta"
platform="OpenMetadata"
availableFeatures=["Reverse Metadata (Collate Only)"]
unavailableFeatures=["Metadata", "Usage", "Data Profiler", "Data Quality", "Lineage"]
/ %}

In this section, we provide guides and references to use the Apache Ranger connector for reverse metadata ingestion.

Configure and schedule Apache Ranger reverse metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Reverse Metadata Ingestion](#reverse-metadata-ingestion)
- [Connection Details](#connection-details)
- [Troubleshooting](#troubleshooting)

## Requirements

### Apache Ranger Setup
Apache Ranger 2.0 or greater is required. The user should have access to the Apache Ranger Admin API with appropriate privileges to manage policies and tags.

### Permissions
The user connecting to Apache Ranger should have the following permissions:
- Access to Apache Ranger Admin API endpoints
- Write access to policies and tag definitions
- Write access to tag management
- Read access to service definitions for verification

```bash
# Create a service user in Apache Ranger with the following permissions:
# - Write access to tag management
# - Write access to policy management
# - Read access to service definitions
```

### Connection Details
We support Apache Ranger with Basic Authentication using username and password.


## Reverse Metadata Ingestion

The Apache Ranger connector is designed specifically for **reverse metadata ingestion**. This means that OpenMetadata will sync metadata information (primarily tags) from your data sources back to Apache Ranger.

### How Reverse Metadata Works

1. **Configure Ranger as Sink Service**: Set up Apache Ranger as a sink service in your reverse metadata configuration
2. **Source Service Integration**: When you ingest metadata from source services like Snowflake, Trino, or other databases, OpenMetadata can sync this metadata back to Ranger
3. **Tag Synchronization**: Currently, we sync tag information from OpenMetadata to Apache Ranger, allowing you to manage security policies based on discovered metadata
4. **Policy Management**: While we sync tags to Ranger, the communication between Ranger and your specific data sources needs to be configured separately

### Important Considerations

- **Service Name Matching**: The service name configured in Apache Ranger must match exactly with the service name in OpenMetadata for reverse metadata synchronization to work properly
- **Tag Synchronization**: Currently, we only sync tag information to Ranger.
- **Source-Ranger Communication**: You are responsible for configuring the communication between Apache Ranger and your actual data sources. OpenMetadata only handles the metadata synchronization to Ranger
- **Bidirectional Sync**: This is currently a one-way sync from OpenMetadata to Ranger

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Apache Ranger", 
    selectServicePath: "/images/v1.9/connectors/domodasrangerhboard/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/ranger/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/ranger/service-connection.png",
} 
/%}
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
