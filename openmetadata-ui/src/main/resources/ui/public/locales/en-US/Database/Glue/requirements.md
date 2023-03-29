# Requirements

The Glue connector ingests metadata through AWS [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/glue.html) Client.

The user must have `glue:GetDatabases` and `glue:GetTables` permissions for the ingestion to run successfully.

You can find further information on the Glue connector in the [docs](https://docs.open-metadata.org/connectors/database/glue).
