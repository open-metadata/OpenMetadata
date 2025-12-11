# ServiceNow

In this section, we provide guides and references to use the ServiceNow connector.

## Requirements

To extract metadata from ServiceNow, you will need:

- **API Access**: Your ServiceNow instance must have REST API access enabled.
- **User Permissions**: The user account provided must have read access to the following ServiceNow tables:
  - `sys_db_object` - To read table metadata
  - `sys_dictionary` - To read column/field metadata
- **Instance Accessibility**: The ServiceNow instance URL must be reachable from the OpenMetadata server.

$$note
Ensure that your user account has sufficient privileges to query metadata tables. If you are unsure about your permissions, contact your ServiceNow administrator to confirm that your account can access the `sys_db_object` and `sys_dictionary` tables via REST API.
$$

## Connection Details

$$section
### ServiceNow Instance URL $(id="hostPort")

ServiceNow instance URL (e.g., `https://your-instance.service-now.com`). 

This should be the full URL to your ServiceNow instance. OpenMetadata will connect to this instance to extract metadata from your ServiceNow tables and schemas.
$$

$$section
### Username $(id="username")

Username to connect to ServiceNow. This user should have read access to `sys_db_object` and `sys_dictionary` tables to extract metadata successfully.
$$

$$section
### Password $(id="password")

Password to connect to ServiceNow.
$$

$$section
### Include Scopes as Schemas $(id="includeScopes")

If enabled, ServiceNow application scopes will be imported as database schemas. This allows you to organize your tables by their application scope.

When disabled, all tables will be imported under a single default schema.

Default: `false`
$$

$$section
### Include System Tables $(id="includeSystemTables")

If enabled, both admin and system tables (tables starting with `sys_*`) will be fetched during metadata extraction.

When disabled, only admin tables will be fetched, excluding system tables.

Default: `false`
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$