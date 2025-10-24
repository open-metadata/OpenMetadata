from metadata.ingestion.source.database.doris.connection import DorisConnection
from metadata.ingestion.source.database.doris.lineage import DorisLineageSource
from metadata.ingestion.source.database.doris.metadata import DorisSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DorisSource,
    lineage_source_class=DorisLineageSource,
    connection_class=DorisConnection,
)
