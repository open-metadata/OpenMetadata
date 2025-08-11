from metadata.ingestion.source.database.teradata.lineage import TeradataLineageSource
from metadata.ingestion.source.database.teradata.metadata import TeradataSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=TeradataSource,
    lineage_source_class=TeradataLineageSource,
)
