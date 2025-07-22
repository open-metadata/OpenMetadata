---
title: Apache Ranger Connector | OpenMetadata Security Integration Guide
description: Set up Apache Ranger security connector for OpenMetadata to automatically discover, catalog, and manage your Apache Ranger security policies and metadata. Step-by-step configuration guide.
slug: /connectors/security/ranger
---

{% connectorDetailsHeader
name="Apache Ranger"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Security Policies", "Access Controls"]
unavailableFeatures=["Data Profiler", "Data Quality", "Lineage"]
/ %}

In this section, we provide guides and references to use the Apache Ranger connector.

Configure and schedule Apache Ranger metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/security/ranger/yaml"} /%}

## Requirements

### Metadata
Apache Ranger 2.0 or greater is required. The user should have access to the Apache Ranger Admin API with appropriate privileges to read policies, roles, and service definitions.

### Permissions
The user connecting to Apache Ranger should have the following permissions:
- Access to Apache Ranger Admin API endpoints
- Read access to policies and service definitions
- Read access to roles and user management information

```bash
# Create a service user in Apache Ranger with the following permissions:
# - Read access to all policies
# - Read access to all service definitions
# - Read access to roles and users
```

### Connection Details
We support Apache Ranger with the following authentication methods:
- **Basic Authentication**: Username and password
- **Kerberos Authentication**: Keytab file and principal (for Kerberos-enabled clusters)

### Python Requirements
{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Apache Ranger connector, you need to install:

```bash
pip3 install "openmetadata-ingestion[ranger]"
```

## Metadata Ingestion

{% partial file="/v1.9/connectors/metadata-ingestion-ui.md" /%}

### 1. Visit the Services Page

The first step is ingesting the metadata from your Apache Ranger instance. Under Settings, you will find a Services link an external source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.

{% image
src="/images/v1.9/connectors/visit-services.png"
alt="Visit Services Page"
caption="Find Services under the Settings menu"
/%}

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

{% image
src="/images/v1.9/connectors/create-service.png"
alt="Create a new service"
caption="Add a new Service from the Services page"
/%}

### 3. Select the Service Type

Select Security Service as the service type and click Next.

{% image
src="/images/v1.9/connectors/select-security-service.png"
alt="Select Service"
caption="Select your service from the list"
/%}

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

{% table %}
- Field | Description
- --- | ---
- **Name** | Name of the service. This should be a unique identifier.
- **Description** | Description of the service. This helps other users understand what this service is about.
{% /table %}

{% image
src="/images/v1.9/connectors/add-new-service.png"
alt="Add New Service"
caption="Provide a Name and description for your Service"
/%}

### 5. Configure the Service Connection

In this step, we will configure the connection settings required to connect to Apache Ranger.

{% image
src="/images/v1.9/connectors/security/ranger/service-connection.png"
alt="Configure service connection"
caption="Configure the service connection by filling the form"
/%}

{% connectorDetailsHeader
name="Apache Ranger"
/ %}

{% table %}
- Parameter | Description
- --- | ---
- **Host and Port** | Apache Ranger Admin URL (e.g., `https://ranger-admin.example.com:6080`)
- **Username** | Username to connect to Apache Ranger
- **Password** | Password to connect to Apache Ranger
- **Keytab Path** | Path to the keytab file for Kerberos authentication (optional)
- **Principal** | Kerberos principal for authentication (optional)
- **Verify SSL** | Whether to verify SSL certificates when connecting to Apache Ranger
- **SSL Config** | SSL configuration for secure connections
{% /table %}

#### Connection Options (Optional)
- **Connection Arguments**: Additional connection arguments that can be sent to Apache Ranger during the connection. These are commonly used for additional security configurations.
- **Connection Options**: Additional connection options to be used with the Apache Ranger connection.

### Connection Details

{% table %}
- If you need information about how to configure these credentials, please reach out on [Slack](https://slack.open-metadata.org/).
{% /table %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/security/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

## Security

Apache Ranger provides fine-grained access control and security policies for your data infrastructure. The OpenMetadata Apache Ranger connector extracts:

- **Security Policies**: Access control policies for various services
- **Roles and Permissions**: User roles and their associated permissions
- **Service Definitions**: Definitions of services managed by Ranger
- **Access Audits**: Information about access patterns and policy enforcement

### Security Features

1. **Policy Management**: View and track access control policies across your data infrastructure
2. **Role-Based Access Control**: Monitor user roles and their permissions
3. **Compliance Tracking**: Track policy compliance and access patterns
4. **Audit Trail**: Maintain comprehensive audit logs of security configurations

## Troubleshooting

### Connection Issues
- Verify that the Apache Ranger Admin service is running and accessible
- Check network connectivity between OpenMetadata and Apache Ranger
- Ensure the provided credentials have the necessary permissions

### Authentication Issues
- For basic authentication, verify username and password
- For Kerberos authentication, ensure keytab file is accessible and principal is correct
- Check if SSL certificates are properly configured if using HTTPS

### API Access Issues
- Verify that the user has read access to Apache Ranger APIs
- Check if the Apache Ranger API endpoints are enabled and accessible
- Ensure proper permissions are granted for policy and role retrieval

{% partial file="/v1.9/connectors/troubleshooting.md" /%} 