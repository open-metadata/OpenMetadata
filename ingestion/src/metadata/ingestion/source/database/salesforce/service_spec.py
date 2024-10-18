from metadata.ingestion.source.database.salesforce.metadata import SalesforceSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SalesforceSource)
