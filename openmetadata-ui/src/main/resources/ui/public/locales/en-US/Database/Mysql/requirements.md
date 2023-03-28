
# Requirements
To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with custom Airflow plugins to handle the workflow deployment.

Note that We support MySQL (version 8.0.0 or greater) and the user should have access to the `INFORMATION_SCHEMA` table.

You can find further information on the Athena connector in the [docs](https://docs.open-metadata.org/connectors/database/mysql).