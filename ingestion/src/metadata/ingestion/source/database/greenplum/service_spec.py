from metadata.ingestion.source.database.greenplum.lineage import GreenplumLineageSource
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=GreenplumSource,
    lineage_source_class=GreenplumLineageSource,
)
