from metadata.ingestion.source.database.iomete.lineage import IometeLineageSource
from metadata.ingestion.source.database.iomete.metadata import IometeSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=IometeSource,
    lineage_source_class=IometeLineageSource,
)
