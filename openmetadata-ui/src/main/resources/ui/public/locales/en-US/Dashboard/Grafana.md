# Grafana

In this section, we provide guides and references to use the Grafana connector.

## Requirements

To access the Grafana APIs and import dashboards and panels from Grafana into OpenMetadata, you need appropriate permissions on your Grafana instance.

- Use a Service Account Token for authentication (token format typically starts with `glsa_`).
- The token must have sufficient permissions to read dashboards, folders and datasources. Admin role is recommended for full coverage.

You can find further information on the Grafana connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/grafana" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

The base URL of your Grafana instance.

**Examples:**
- Grafana Cloud: `https://<your-org>.grafana.net`
- Self-hosted: `https://grafana.company.com`
- Local development: `http://localhost:3000`

If you are running the OpenMetadata ingestion in a docker and your Grafana instance is hosted on `localhost`, then use `host.docker.internal` as the hostname.
$$

$$section
### Service Account Token $(id="apiKey")

Service Account Token to authenticate to the Grafana APIs.

- Prefer Service Account Tokens (format like `glsa_xxxxx`).
- Legacy API Keys are no longer supported by Grafana as of January 2025.
- Both self-hosted and Grafana Cloud are supported.
- Admin role is recommended for full metadata extraction.
$$

$$section
### Verify SSL $(id="verifySSL")

Enable or disable SSL certificate verification when connecting to Grafana.

- Default: `true`
- Disable only for development/testing purposes.
$$

$$section
### Page Size $(id="pageSize")

Page size used for paginated Grafana API requests.

- Default: `100`
- Increase if you have many dashboards and want to reduce API calls.
$$
