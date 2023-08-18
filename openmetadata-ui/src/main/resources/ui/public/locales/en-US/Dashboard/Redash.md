# Redash

In this section, we provide guides and references to use the Redash connector.

## Requirements

We connect to Redash through the [API](https://redash.io/help/user-guide/integrations-and-api/api) endpoint, so the user we use in the configuration to ingest data must have enough permissions to view all the data. For more info about the permissions, please visit Redash documentation [here](https://redash.io/help/user-guide/users/permissions-groups).

You can find further information on the Redash connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/redash).

## Connection Details

$$section
### Username $(id="username")

Specify the User to connect to Redash. It should have enough privileges to read all the metadata.
$$

$$section
### Host Port $(id="hostPort")

URL for the Redash instance.
$$

$$section
### API Key $(id="apiKey")

API key of the redash instance to access. It has the same permissions as the user who owns it. It can be found on a user profile page.
$$

$$section
### Redash Version $(id="redashVersion")

Redash version of your redash instance. Enter the numerical value from the [Redash Releases](https://github.com/getredash/redash/releases) page.

The default version is `10.0.0`.
$$
