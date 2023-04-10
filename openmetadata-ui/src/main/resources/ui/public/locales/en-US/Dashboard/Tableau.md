# Tableau

In this section, we provide guides and references to use the Tableau connector.

# Requirements

To ingest Tableau metadata, the username used in the configuration **must** have at least the following role: `Site Role: Viewer`.

To create lineage between Tableau dashboards and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server. For more information on enabling the Tableau Metadata APIs follow the link [here](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html).

You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/tableau).

## Connection Details

### Host Port $(id="hostPort")

Name or IP address of your installation of Tableau Server. 

For example: `https://my-prod-env.online.tableau.com/`.

### Username $(id="username")

The name of the user whose credentials will be used to sign in.

### Password $(id="password")

The password of the user.

### Api Version $(id="apiVersion")

When we make a request, we include the API version number as part of the request, as in the following example:

`https://{hostPort}/api/{api_version}/auth/signin`

A lists versions of Tableau Server and of the corresponding REST API and REST API schema versions can be found [here](https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm).

### Site Name $(id="siteName")

This corresponds to the `contentUrl` attribute in the Tableau REST API. 

The `site_name` is the portion of the URL that follows the `/site/` in the URL. 

For example, _MarketingTeam_ is the `site_name` in the following URL `MyServer/#/site/MarketingTeam/projects`. 

If it is empty, the default Tableau site will be used.

### Site Url $(id="siteUrl")

If it is empty, the default Tableau site will be used.

### Personal Access Token Name $(id="personalAccessTokenName")

The personal access token name.

For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).

### Personal Access Token Secret $(id="personalAccessTokenSecret")

The personal access token value.

For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).

### Env $(id="env")

The config object can have multiple environments. The default environment is defined as `tableau_prod`, and you can change this if needed by specifying an `env` parameter.

### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabled.

Possible values:
- `validate`: Validate the certificate using the public certificate (recommended).
- `ignore`: Ignore the certification validation (not recommended for production).
- `no-ssl`: SSL validation is not needed.

### Ssl Config $(id="sslConfig")

Client SSL configuration in case we are connection to a host with SSL enabled.

### Certificate Path $(id="certificatePath")

CA certificate path in the instance where the ingestion run. E.g., `/path/to/public.cert`. 

Will be used if Verify SSL is set to `validate`.

