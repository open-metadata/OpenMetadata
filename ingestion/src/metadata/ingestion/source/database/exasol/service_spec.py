from metadata.ingestion.source.database.exasol.lineage import ExasolLineageSource
from metadata.ingestion.source.database.exasol.metadata import ExasolSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=ExasolSource,
    lineage_source_class=ExasolLineageSource,
)
