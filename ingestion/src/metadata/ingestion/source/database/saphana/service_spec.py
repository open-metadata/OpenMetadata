from metadata.ingestion.source.database.saphana.connection import SapHanaConnection
from metadata.ingestion.source.database.saphana.lineage import SaphanaLineageSource
from metadata.ingestion.source.database.saphana.metadata import SaphanaSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SaphanaSource,  # pyright: ignore[reportArgumentType]
    lineage_source_class=SaphanaLineageSource,  # pyright: ignore[reportArgumentType]
    connection_class=SapHanaConnection,  # pyright: ignore[reportArgumentType]
)
