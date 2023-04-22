# DomoDatabase

In this section, we provide guides and references to use the DomoDatabase connector.

# Requirements
For metadata ingestion, kindly make sure to add at least `data` scopes to the clientId provided. For question related to scopes, click [here](https://developer.domo.com/docs/authentication/quickstart-5).

You can find further information on the Domo Database connector in the [docs](https://docs.open-metadata.org/connectors/database/domo-database).

## Connection Details

$$section
### Client ID $(id="clientId")

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

$$section
### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
$$