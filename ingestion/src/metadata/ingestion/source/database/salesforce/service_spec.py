from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.salesforce.metadata.SalesforceSource",
    connection_class="metadata.ingestion.source.database.salesforce.connection.SalesforceConnection",
)
