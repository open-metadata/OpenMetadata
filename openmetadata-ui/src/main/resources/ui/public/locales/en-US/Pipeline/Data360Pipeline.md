# Salesforce Data 360 Pipeline

In this section, we provide guides and references to use the Salesforce Data 360 Pipeline connector.

This connector extracts **DataStreams**, **Calculated Insights**, and **DataTransforms** from your Salesforce Data 360 org as pipeline entities, with full support for metadata, lineage, and operational run status.

## Requirements

- A Salesforce Connected App with OAuth 2.0 Client Credentials flow enabled.
- The connected app must have the **Manage Data Cloud** and **Access Data Cloud APIs** OAuth scopes.
- For lineage: a Data 360 database service must be ingested first. Set `data360DbServiceName` to its service name.

## Connection Details

$$section
### Consumer Key $(id="consumerKey")

The Consumer Key (Client ID) from your Salesforce Connected App.
$$

$$section
### Consumer Secret $(id="consumerSecret")

The Consumer Secret (Client Secret) from your Salesforce Connected App.
$$

$$section
### Salesforce API Version $(id="salesforceApiVersion")

The Salesforce REST API version to use. Defaults to `63.0`.
$$

$$section
### Salesforce Domain $(id="salesforceDomain")

The login domain for your Salesforce org. Use `login` for production or `test` for sandboxes.
$$

$$section
### Data 360 Database Service Name $(id="data360DbServiceName")

The OpenMetadata service name of the corresponding Data 360 **database** service. Required to resolve lineage between pipeline entities (DataStreams, Calculated Insights, DataTransforms) and their source/target tables (DLOs, DMOs, CIOs).
$$

$$section
### Pagination Limit $(id="paginationLimit")

Number of records to fetch per API page. Default is `10`. Valid range is `1–200`.
$$
