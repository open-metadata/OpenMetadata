# Dagster

In this section, we provide guides and references to use the Dagster connector.

## Requirements

OpenMetadata is integrated with dagster upto version [1.0.13](https://docs.dagster.io/getting-started) and will continue to work for future dagster versions.

The ingestion framework uses [dagster graphql python client](https://docs.dagster.io/_apidocs/libraries/dagster-graphql#dagster_graphql.DagsterGraphQLClient) to connect to the dagster instance and perform the API calls.

You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/pipeline/dagster).

## Connection Details

$$section
### Host $(id="host")

URL to the Dagster instance
Host and port of the Dagster service. For example: `localhost:1433`
$$

$$section
### Token $(id="token")

To Connect to Dagster Cloud.
- Log in to your Dagster account.
- Click on the "Settings" link in the top navigation bar.
- Click on the "API Keys" tab.
- Click on the "Create a New API Key" button.
- Give your API key a name and click on the "Create API Key" button.
- Copy the generated API key to your clipboard and paste it in the field.
$$
