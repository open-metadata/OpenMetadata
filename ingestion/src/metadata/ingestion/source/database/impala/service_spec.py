from metadata.ingestion.source.database.impala.connection import ImpalaConnection
from metadata.ingestion.source.database.impala.lineage import ImpalaLineageSource
from metadata.ingestion.source.database.impala.metadata import ImpalaSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=ImpalaSource,
    lineage_source_class=ImpalaLineageSource,
    connection_class=ImpalaConnection,  # pyright: ignore[reportArgumentType]
)
