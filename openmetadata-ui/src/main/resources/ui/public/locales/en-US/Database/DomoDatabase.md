# DomoDatabase

In this section, we provide guides and references to use the DomoDatabase connector.

## Requirements
<!-- to be updated -->
For metadata ingestion, kindly make sure add alteast `data` scopes to the clientId provided. Question related to scopes, click here.

You can find further information on the Domo Database connector in the [docs](https://docs.open-metadata.org/connectors/database/domo-database).

## Connection Details

$$section
### Client Id $(id="clientId")

Client ID for DOMO. Further information on Client ID can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#how-to-find-clientid)
<!-- clientId to be updated -->
$$

$$section
### Secret Token $(id="secretToken")

Secret Token to connect DOMO
<!-- secretToken to be updated -->
$$

$$section
### Access Token $(id="accessToken")

Access token to connect to DOMO. Further information on Client ID can be found [here](https://docs.open-metadata.org/connectors/database/domo-database/troubleshoot#where-to-find-accesstoken)
<!-- accessToken to be updated -->
$$

$$section
### Api Host $(id="apiHost")

API Host to connect to DOMO instance. Default value here is `api.domo.com`
<!-- apiHost to be updated -->
$$

$$section
### Sandbox Domain $(id="sandboxDomain")

Connect to Sandbox Domain. For example `https://<your>.domo.com`
<!-- sandboxDomain to be updated -->
$$

$$section
### Database Name $(id="databaseName")

Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
<!-- databaseName to be updated -->
$$