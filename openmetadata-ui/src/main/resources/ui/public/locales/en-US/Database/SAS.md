# SAS Viya

In this section, we provide guides and references to use the SAS Viya connector.

## Requirements

### SAS Information Catalog Access

To extract metadata from SAS Viya, the user needs access to the SAS Information Catalog APIs. The user should have the following permissions:

- **Read access** to SAS Information Catalog
- Ability to execute catalog search queries
- Access to metadata endpoints via REST API

### Authentication

SAS Viya uses username/password authentication for API access. Ensure that the user account has:

```
- Valid SAS Viya credentials
- Permissions to access the Information Catalog service
- API access enabled for the user account
```

### API Endpoints

The connector uses the SAS Viya REST APIs to extract metadata, specifically:
- **Catalog Search API**: For discovering and filtering catalog items (<a href="https://developer.sas.com/apis/rest/DataManagement/#catalog-search" target="_blank">API documentation</a>)
- **Catalog Items API**: For retrieving detailed metadata about tables, columns, and relationships

### Minimum Permissions

The user account should have at least the following SAS capabilities:
- **Read capability** on catalog objects
- Access to view table and column metadata
- Permission to execute search queries against the Information Catalog

$$note
The connector supports filter expressions to scope metadata ingestion. This can be useful if your user has limited access to specific catalog items.
$$

You can find further information on the SAS connector in the <a href="https://docs.open-metadata.org/connectors/metadata/sas" target="_blank">docs</a>.

## Connection Details

$$section
### Username $(id="username")

Username to connect to SAS Viya. This user should have privileges to read all the metadata in SAS Information Catalog.
$$

$$section
### Password $(id="password")

Password to connect to SAS Viya.
$$

$$section
### ServerHost $(id="serverHost")

Server host and port of SAS Viya.
$$

$$section
### Filter $(id="filter")

A filter expression specifying items for import. For more information <a href="https://developer.sas.com/apis/rest/DataManagement/#catalog-search" target="_blank">see</a>

$$

