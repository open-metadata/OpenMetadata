# Domo

In this section, we provide guides and references to use the Domo Dashboard connector.

## Requirements

For the metadata ingestion, make sure to add at least the `dashboard` scope to the Client ID provided. For questions related to scopes, click <a href="https://developer.domo.com/portal/1845fc11bbe5d-api-authentication" target="_blank">here</a>.

You can find further information on the Domo Dashboard connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/domo-dashboard" target="_blank">docs</a>.

## Connection Details

$$section
### Client ID $(id="clientId")

Client ID for Domo. Further information can be found <a href="https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#how-to-find-clientid" target="_blank">here</a>.

This needs to be informed together with the `Secret Token` and is used to extract metadata from Domo's official API.
$$

$$section
### Secret Token $(id="secretToken")

Secret Token to connect to Domo.
$$

$$section
### Access Token $(id="accessToken")

Access token to connect to Domo. Further information can be found <a href="https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#where-to-find-accesstoken" target="_blank">here</a>.

This is required to automate metadata extraction directly from the instance for endpoints not supported by the API, such as Cards or Pipeline Runs.
$$

$$section
### API Host $(id="apiHost")

API Host to connect your Domo instance. By default: `api.domo.com`.
$$

$$section
### Instance Domain $(id="instanceDomain")

URL to connect to your Domo instance UI. For example `https://<your>.domo.com`.
$$
