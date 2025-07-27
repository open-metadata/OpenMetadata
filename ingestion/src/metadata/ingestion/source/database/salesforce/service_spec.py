from metadata.ingestion.source.database.salesforce.metadata import SalesforceSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SalesforceSource)
