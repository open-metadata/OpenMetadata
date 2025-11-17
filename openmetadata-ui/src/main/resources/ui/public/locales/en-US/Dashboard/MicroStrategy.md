# MicroStrategy

In this section, we provide guides and references to use the MicroStrategy connector.

## Requirements

### User Authentication

To extract metadata from MicroStrategy, you need a user account with appropriate permissions to access the MicroStrategy REST API. MicroStrategy supports multiple authentication modes through its REST API.

### Authentication Modes

MicroStrategy REST API supports different login modes:

| Login Mode | Value | Description | Use Case |
|------------|-------|-------------|----------|
| **Standard** | 1 | Standard username/password authentication | Most common for production environments |
| **Anonymous** | 8 | Guest/anonymous authentication | Demo environments or public instances |
| **LDAP** | 16 | LDAP directory authentication | Enterprise LDAP integration |
| **Integrated** | 32 | Windows integrated authentication | Windows domain environments |

$$note
For most deployments, use **Standard (1)** authentication mode. The **Anonymous (8)** mode is typically used for MicroStrategy demo environments.
$$

### Required Permissions

The user account needs the following MicroStrategy privileges:

#### REST API Access
- **Web User** privilege (minimum requirement)
- Permission to authenticate and create sessions via REST API
- Access to the MicroStrategy Library or Web services

#### Project Access
```
- Browse privilege on projects containing dashboards/dossiers
- Execute privilege on documents and dossiers
- View privilege on dashboard content
```

#### Specific Capabilities
The user must be able to perform these operations via REST API:

```
- POST /api/auth/login - Authenticate and obtain auth token
- GET /api/projects - List accessible projects
- GET /api/projects/{projectId}/dossiers - List dossiers (dashboards)
- GET /api/documents - List documents (reports)
- GET /api/folders - Browse folder structure
```

### MicroStrategy Privileges

Ensure the user has at minimum the following privileges in MicroStrategy:

| Privilege Category | Required Privilege | Purpose |
|-------------------|-------------------|---------|
| **Web** | Web User | Access REST API |
| **Project** | Browse | Navigate project structure |
| **Objects** | Execute | Run dossiers and documents |
| **Objects** | Browse | View object definitions |

$$note
The user does not need administrative privileges. **Web User** with **Execute** and **Browse** privileges on relevant projects is sufficient for metadata extraction.
$$

### API Endpoints Used

The connector interacts with the following MicroStrategy REST API endpoints:

```
- POST {hostPort}/MicroStrategyLibrary/api/auth/login
- GET {hostPort}/MicroStrategyLibrary/api/projects
- GET {hostPort}/MicroStrategyLibrary/api/projects/{projectId}/dossiers
- GET {hostPort}/MicroStrategyLibrary/api/documents
- GET {hostPort}/MicroStrategyLibrary/api/folders
```

### Network and Configuration

- The MicroStrategy instance must be network accessible from where OpenMetadata ingestion runs
- REST API services must be enabled on the MicroStrategy instance
- SSL/TLS certificates must be valid if using HTTPS
- Firewall rules should allow HTTP/HTTPS traffic to MicroStrategy

You can find further information on the MicroStrategy connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/microstrategy" target="_blank">docs</a>.

## Connection Details

$$section
### Username $(id="username")

Username to connect to MicroStrategy, e.g., `user@organization.com`. This user should have access to relevant dashboards and charts in MicroStrategy to fetch the metadata.
$$

$$section
### Password $(id="password")

Password of the user account to connect with MicroStrategy.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host of the MicroStrategy instance. This should be specified as a URI string in the format http://hostname or https://hostname.

For example, you might set it to https://demo.microstrategy.com.
$$

$$section
### Login Mode $(id="loginMode")

Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`.
If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`.
$$
