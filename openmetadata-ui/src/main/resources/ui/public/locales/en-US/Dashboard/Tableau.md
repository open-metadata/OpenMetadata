# Tableau

In this section, we provide guides and references to use the Tableau connector.

## Requirements

To ingest Tableau metadata, the username used in the configuration **must** have at least the following role: `Site Role: Viewer`.

To create lineage between Tableau dashboards and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server. For more information on enabling the Tableau Metadata APIs follow the link <a href="https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html" target="_blank">here</a>.

You can find further information on the Tableau connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/tableau" target="_blank">docs</a>.


## Authentication Type

### 1. Basic Authentication

$$section
### Username $(id="username")

The name of the user whose credentials will be used to sign in.
$$

$$section
### Password $(id="password")

The password of the user.
$$

### 2. Access Token Authentication

$$section
### Personal Access Token Name $(id="personalAccessTokenName")

The personal access token name.

For more information on how to get a Personal Access Token, you can visit the official <a href="https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm" target="_blank">docs</a>.
$$

$$section
### Personal Access Token Secret $(id="personalAccessTokenSecret")

The personal access token value.

For more information on how to get a Personal Access Token, you can visit the official <a href="https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm" target="_blank">docs</a>.
$$

## Connection Details

$$section
### Host Port $(id="hostPort")

URL or IP address of your installation of Tableau Server. 

For example: `https://my-prod-env.online.tableau.com/`.
$$

$$section
### API Version $(id="apiVersion")

When we make a request, we include the API version number in the request as in the following example: `https://{hostPort}/api/{api_version}/auth/signin`

Find <a href="https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm" target="_blank">here</a> a list of Tableau Server versions and its corresponding REST API versions.
$$

$$section
### Site Name $(id="siteName")

This corresponds to the `contentUrl` attribute in the Tableau REST API. The `site_name` is the portion of the URL that follows the `/site/` in the URL. 

For example, `MarketingTeam` is the `site_name` in the following URL `MyServer/#/site/MarketingTeam/projects`. 

If it is empty, the default Tableau site will be used.
$$

$$section
### Site URL $(id="siteUrl")

If it is empty, the default Tableau site name will be used.
$$

$$section
### Environment $(id="env")

The config object can have multiple environments. The default environment is defined as `tableau_prod`, and you can change this if needed by specifying an `env` parameter.
$$

$$section
### Pagination Limit $(id="paginationLimit")

The pagination limit will be used while querying the Tableau Graphql endpoint to get the data source information.
$$

$$section
### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabled.

Possible values:
- `validate`: Validate the certificate using the public certificate (recommended).
- `ignore`: Ignore the certification validation (not recommended for production).
- `no-ssl`: SSL validation is not needed.
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL configuration in case we are connection to a host with SSL enabled.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation.
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication.
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate.
$$