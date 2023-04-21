# DomoDashboard

In this section, we provide guides and references to use the DomoDashboard connector.

# Requirements

For metadata ingestion, kindly make sure to add at least `dashboard` scopes to the clientId provided. For questions related to scopes, click [here](https://developer.domo.com/docs/authentication/quickstart-5).

You can find further information on the Domo Dashboard connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/domo-dashboard).

## Connection Details

$$section
### Client Id $(id="clientId")

Client ID for DOMO. Further information on Client ID can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#how-to-find-clientid).
$$

$$section
### Secret Token $(id="secretToken")

Secret Token to connect DOMO.
$$

$$section
### Access Token $(id="accessToken")

Access token to connect to DOMO. Further information on Access Token can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#where-to-find-accesstoken).
$$

$$section
### API Host $(id="apiHost")

API Host to connect to DOMO instance. Default: `api.domo.com`.
$$

$$section
### Sandbox Domain $(id="sandboxDomain")

Connect to Sandbox Domain. For example `https://<your>.domo.com`.
$$
