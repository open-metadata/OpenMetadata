from metadata.ingestion.source.database.timescale.connection import TimescaleConnection
from metadata.ingestion.source.database.timescale.lineage import TimescaleLineageSource
from metadata.ingestion.source.database.timescale.metadata import TimescaleSource
from metadata.ingestion.source.database.timescale.usage import TimescaleUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=TimescaleSource,
    lineage_source_class=TimescaleLineageSource,
    usage_source_class=TimescaleUsageSource,
    connection_class=TimescaleConnection,
)
