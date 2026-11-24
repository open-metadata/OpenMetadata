# Salesforce Data 360

In this section, we provide guides and references to use the Salesforce Data 360 connector.

Salesforce Data 360 (formerly DataCloud) is a unified data platform that unifies customer data across your organization. This connector ingests dataspaces as databases, and Data Lake Objects (DLO), Data Model Objects (DMO), and Calculated Insights (CIO) as schemas and tables.

## Requirements

- A Salesforce Connected App with OAuth 2.0 Client Credentials flow enabled.
- The connected app must have the Data 360 OAuth scopes `cdp_query_api` and `cdp_profile_api`.
- The integration user must have the **Data Cloud Admin** or equivalent permission set.

You can find further information on the Salesforce Data 360 connector in the <a href="https://docs.getcollate.io/connectors/database/data360" target="_blank">docs</a>.

## Connection Details

$$section
### Consumer Key $(id="consumerKey")

The Consumer Key (Client ID) from your Salesforce Connected App. Found under **Setup → App Manager → your app → Manage Consumer Details**.
$$

$$section
### Consumer Secret $(id="consumerSecret")

The Consumer Secret (Client Secret) from your Salesforce Connected App. Found in the same location as the Consumer Key.
$$

$$section
### Salesforce API Version $(id="salesforceApiVersion")

The Salesforce REST API version to use (e.g. `63.0`). Defaults to `63.0`. Use the latest stable version available in your org.
$$

$$section
### Salesforce Domain $(id="salesforceDomain")

Your org's **My Domain**, without `.salesforce.com` (e.g. `mycompany.my` for `mycompany.my.salesforce.com`). The client-credentials flow works only on My Domain: Salesforce rejects `login` and `test` with `invalid_grant: request not supported on this domain`.
$$

$$section
### Pagination Limit $(id="paginationLimit")

Number of records to fetch per API page. Default is `10`. Valid range is `1–100`. Increase for large catalogs; decrease if you hit API rate limits.
$$
