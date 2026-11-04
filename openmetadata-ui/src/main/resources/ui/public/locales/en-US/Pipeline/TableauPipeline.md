# Tableau Pipeline

In this section, we provide guides and references to use the Tableau Pipeline connector. It ingests Tableau Prep flows as pipelines, their flow runs as pipeline status, and their lineage. It also ingests the extract refreshes of published data sources and workbooks as pipelines, with their refresh jobs as pipeline status.

## Requirements

The user in the configuration **must** have at least the `Site Role: Viewer` and View permission on the projects holding the flows to ingest. Users who are not site or server administrators only see the runs of flows they can view.

Flows can be run manually on any Tableau site, but scheduled flow runs require <a href="https://help.tableau.com/current/prep/en-us/prep_conductor_overview.htm" target="_blank">Tableau Prep Conductor</a> (Data Management).

To ingest lineage — the tables and published data sources a flow reads and writes, and the flows that consume its output — enable the Tableau Metadata API on Tableau Server. It is always enabled on Tableau Cloud. For more information follow the link <a href="https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html" target="_blank">here</a>.

Extract refresh history is read from Tableau's background jobs, which Tableau only lists to site administrators. With a non-admin account, extract refresh pipelines are ingested without status.

Lineage to published data sources points at the data models created by the Tableau dashboard connector, so run that connector first.

## Authentication Type

### 1. Basic Authentication

$$section
### Username $(id="username")

The name of the user whose credentials will be used to sign in.

With Connected App Authentication, this is the Tableau user OpenMetadata signs in as, and ingestion runs with that user's permissions. On Tableau Cloud enter the user's email address. On Tableau Server, Tableau's documentation asks for the user name.
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

### 3. Connected App Authentication

OpenMetadata signs a short-lived JSON Web Token (JWT) with the secret of a Tableau connected app that uses direct trust, and signs in as the user in Username.

To set it up, a site administrator:

1. Creates a connected app under **Settings > Connected Apps > New Connected App > Direct Trust**, and chooses the projects it can access.
2. Enables the app. Tableau's documentation states that a new connected app on Tableau Server starts disabled.
3. Generates a secret and copies the Client ID, the Secret ID and the Secret Value.

OpenMetadata requests these scopes: `tableau:content:read`, `tableau:users:read`, `tableau:server:read`, `tableau:flows:read`, `tableau:flow_runs:read`, `tableau:jobs:read`, `tableau:tasks:read`. The token is valid for 5 minutes, so the clock of the host running the ingestion must be correct.

Connected app sign-in has been tested on Tableau Cloud. For Tableau Server, Tableau's documentation sets the floor at 2023.3: Tableau Server 2022.3 to 2023.2 accepts the token for the REST API but not for the Metadata API, so data models and lineage would not be ingested.

For more information, visit the official <a href="https://help.tableau.com/current/online/en-us/connected_apps_direct.htm" target="_blank">docs</a>.

$$section
### Client ID $(id="clientId")

The Client ID of the connected app, shown on the connected app's page.
$$

$$section
### Secret ID $(id="secretId")

The ID of the connected app secret.
$$

$$section
### Secret Value $(id="secretValue")

The value of the connected app secret.
$$

## Connection Details

$$section
### Host and Port $(id="hostPort")

URL of your Tableau Server or Tableau Cloud pod.

For example: `https://my-prod-env.online.tableau.com/`.
$$

$$section
### Site Name $(id="siteName")

This corresponds to the `contentUrl` attribute in the Tableau REST API. The `site_name` is the portion of the URL that follows the `/site/` in the URL.

For example, `MarketingTeam` is the `site_name` in the following URL `MyServer/#/site/MarketingTeam/projects`.

If it is empty, the default Tableau site will be used.
$$

$$section
### API Version $(id="apiVersion")

The REST API version to use. If it is empty, the version reported by the Tableau server is used.

Find <a href="https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm" target="_blank">here</a> a list of Tableau Server versions and their corresponding REST API versions.
$$

$$section
### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSL Config if enabled.

Possible values:
- `validate`: Validate the certificate using the public certificate (recommended).
- `ignore`: Ignore the certification validation (not recommended for production).
- `no-ssl`: SSL validation is not needed.
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL configuration in case we are connecting to a host with SSL enabled.
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

$$section
### Pipeline Filter Pattern $(id="pipelineFilterPattern")

Regex to only include or exclude pipelines by name: a Prep flow by its name, an extract refresh as `<data source or workbook name> extract refresh`.
$$

$$section
### Number of Status $(id="numberOfStatus")

Number of past runs to ingest per flow or extract refresh, between 1 and 100. By default, we will pick up the last 10 runs.
$$

$$section
### Include Extract Refreshes $(id="includeExtractRefreshes")

Ingest the extract refresh tasks of published data sources and workbooks as pipelines, with their refresh jobs as pipeline status. Reading refresh job history requires a site administrator. Enabled by default.
$$
