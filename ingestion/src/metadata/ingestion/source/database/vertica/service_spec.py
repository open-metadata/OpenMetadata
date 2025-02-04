from metadata.ingestion.source.database.vertica.lineage import VerticaLineageSource
from metadata.ingestion.source.database.vertica.metadata import VerticaSource
from metadata.ingestion.source.database.vertica.usage import VerticaUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=VerticaSource,
    lineage_source_class=VerticaLineageSource,
    usage_source_class=VerticaUsageSource,
)
