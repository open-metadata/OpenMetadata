from metadata.ingestion.source.database.hive.connection import HiveConnection
from metadata.ingestion.source.database.hive.lineage import HiveLineageSource
from metadata.ingestion.source.database.hive.metadata import HiveSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=HiveSource,
    lineage_source_class=HiveLineageSource,
    connection_class=HiveConnection,  # pyright: ignore[reportArgumentType]
)
