from metadata.ingestion.source.database.saphana.lineage import SaphanaLineageSource
from metadata.ingestion.source.database.saphana.metadata import SaphanaSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SaphanaSource, lineage_source_class=SaphanaLineageSource
)
