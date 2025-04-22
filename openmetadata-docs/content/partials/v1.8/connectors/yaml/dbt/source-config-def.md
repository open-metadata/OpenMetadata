#### Source Config

{% codeInfo srNumber=120 %}

**dbtUpdateDescriptions**: Configuration to update the description from dbt or not. If set to true descriptions from dbt will override the already present descriptions on the entity. For more details visit [here](/connectors/ingestion/workflows/dbt/ingest-dbt-descriptions)

**dbtUpdateOwners**: Configuration to update the owner from dbt or not. If set to true owners from dbt will override the already present owners on the entity. For more details visit [here](/connectors/ingestion/workflows/dbt/ingest-dbt-owner)

**includeTags**: true or false, to ingest tags from dbt. Default is true.

**dbtClassificationName**: Custom OpenMetadata Classification name for dbt tags.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Add filters to filter out models from the dbt manifest. Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}