# Metabase

In this section, we provide guides and references to use the Metabase connector.

# Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with custom Airflow plugins to handle the workflow deployment.

You can find further information on the Metabase connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/metabase).


## Connection Details

$$section
### Username $(id="username")

Username to connect to Metabase, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Metabase to fetch the metadata.
$$

$$section
### Password $(id="password")

Password of the user account to connect with Metabase.
$$

$$section
### Host Port $(id="hostPort")

The hostPort parameter specifies the host and port of the Metabase instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.metabase.com:3000`.
$$

