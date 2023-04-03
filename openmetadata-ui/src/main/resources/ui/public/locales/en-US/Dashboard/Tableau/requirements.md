# Requirements

To ingest Tableau metadata, the username used in the configuration **must** have at least the following role: `Site Role: Viewer`.

To create lineage between Tableau dashboards and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server. For more information on enabling the Tableau Metadata APIs follow the link [here](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html).

You can find further information on the Kafka connector in the [docs](https://docs.open-metadata.org/connectors/dashboard/tableau).