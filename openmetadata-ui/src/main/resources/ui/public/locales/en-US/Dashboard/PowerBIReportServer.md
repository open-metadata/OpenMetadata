# PowerBI Report Server

In this section, we provide guides and references to use the PowerBI Report Server connector.

## Requirements

### User Authentication

To extract metadata from PowerBI Report Server, you need a user account with appropriate read permissions. PowerBI Report Server uses Windows Authentication or Forms Authentication depending on your deployment configuration.

### Required Permissions

The user account needs the following permissions:

#### Report Server Access
- **Browser** role (minimum) on the folders containing reports you want to extract
- Permission to access the Report Server Web Portal
- Read access to report definitions and metadata

#### Specific Capabilities
```
- View reports and folders
- View report properties and metadata
- Access the Report Server REST API
- Read folder hierarchy
```

### PowerBI Report Server Roles

PowerBI Report Server has several built-in roles. For metadata extraction, assign one of these roles to your user:

| Role | Description | Suitable for OpenMetadata |
|------|-------------|---------------------------|
| **Browser** | View reports and navigate folders | ✅ Yes (Minimum required) |
| **Content Manager** | Full control over content | ✅ Yes (Not required, but works) |
| **My Reports** | User-specific workspace | ❌ No (Limited scope) |
| **Publisher** | Publish reports and datasets | ✅ Yes (More than needed) |
| **Report Builder** | Create reports | ⚠️ Partial (Depends on scope) |

$$note
The **Browser** role is the minimum required permission level. It provides read-only access to reports and dashboards without allowing modifications.
$$

### API Access

The connector uses the PowerBI Report Server REST API endpoints:

```
- GET {hostPort}/{webPortalVirtualDirectory}/api/v2.0/Folders - List folders
- GET {hostPort}/{webPortalVirtualDirectory}/api/v2.0/Reports - List reports
- GET {hostPort}/{webPortalVirtualDirectory}/api/v2.0/PowerBIReports - List PowerBI reports
- GET {hostPort}/{webPortalVirtualDirectory}/api/v2.0/DataSources - Get data source information
```

Ensure the user has permission to access these API endpoints.

### Network and Configuration

- The Report Server must be network accessible from where OpenMetadata ingestion runs
- The Web Portal Virtual Directory must be correctly configured (default is typically `/Reports`)
- SSL/TLS certificates must be valid if using HTTPS
- Firewall rules should allow HTTP/HTTPS traffic to the Report Server

You can find further information on the PowerBI Report Server connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/powerbi-report-server" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Metabase instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. 

For example, you might set it to `http://192.168.1.1:80`.

$$

$$section
### Username $(id="username")
Username to connect to PowerBI Report Server.
$$

$$section
### Password $(id="password")
Password to connect to PowerBI Report Server.
$$

$$section
### Web Portal Virtual Directory Name $(id="webPortalVirtualDirectory")
Web Portal Virtual Directory name which you have configured in your PowerBI Report Server configuration manager.
$$