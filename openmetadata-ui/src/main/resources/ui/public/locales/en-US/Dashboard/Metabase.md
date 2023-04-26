# Metabase

In this section, we provide guides and references to use the Metabase connector.

## Requirements

We will extract the metadata using the [Metabase API](https://www.metabase.com/docs/latest/api-documentation).

You can find further information on the Metabase connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/metabase).

## Connection Details

$$section
### Username $(id="username")

Username to connect to Metabase, e.g., `user@organization.com`. This user should have access to relevant dashboards and charts in Metabase to fetch the metadata.
$$

$$section
### Password $(id="password")

Password of the user account to connect with Metabase.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Metabase instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. 

For example, you might set it to `https://org.metabase.com:3000`.
$$
