# Omni

In this section, we provide guides and references to use the Omni connector.

## Requirements

OpenMetadata relies on Omni's REST API. To know more you can read the <a href="https://docs.omni.co/api" target="_blank">Omni API docs</a>. You will need an Organization API key or a Personal Access Token (PAT) with access to your models and documents. The connector ingests Omni models and topics as data models, documents/workbooks as dashboards (with their tiles as charts), and builds lineage from your warehouse tables through topics to dashboards.

## Connection Details

$$section
### Host Port $(id="hostPort")

The base URL of your Omni instance's API, in the format `https://<your-org>.omniapp.co/api`. This is your Omni login URL with `/api` appended.
$$

$$section
### API Token $(id="token")

The API token used to authenticate with Omni. It is sent as a `Bearer` token in the `Authorization` header. You can use an Organization API key (created by an Organization Admin) or a Personal Access Token. See the <a href="https://docs.omni.co/api/authentication" target="_blank">authentication docs</a>.
$$

$$section
### Verify SSL $(id="verifySSL")

Client SSL verification. Make sure to configure the SSLConfig if enabling this option.
$$

$$section
### SSL Config $(id="sslConfig")

Client SSL configuration. Provide a CA certificate when connecting to an Omni instance behind an internal certificate authority.
$$
