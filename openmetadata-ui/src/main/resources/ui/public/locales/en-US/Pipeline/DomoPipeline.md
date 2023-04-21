# DomoPipeline

In this section, we provide guides and references to use the Domo Pipeline connector.

# Requirements
For metadata ingestion, kindly make sure add alteast `data` scopes to the clientId provided. Question related to scopes, click [here](https://developer.domo.com/docs/authentication/quickstart-5).

You can find further information on the Domo Pipeline connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/domo-pipeline).

## Connection Details

$$section
### Client Id $(id="clientId")

Client ID for DOMO. Further information on Client ID can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#how-to-find-clientid).
$$

$$section
### Secret Token $(id="secretToken")

Secret token to connect to DOMO.
$$

$$section
### Access Token $(id="accessToken")

Access token to connect to DOMO. Further information on Access Token can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#where-to-find-accesstoken).
<!-- accessToken to be updated -->
$$

$$section
### Api Host $(id="apiHost")

API Host to connect to DOMO instance. Default: `api.domo.com`.
$$

$$section
### Sandbox Domain $(id="sandboxDomain")

Connect to Sandbox Domain. For example `https://<your>.domo.com`.
$$
