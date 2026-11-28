from metadata.ingestion.source.database.vertica.connection import VerticaConnection
from metadata.ingestion.source.database.vertica.data_diff.data_diff import (
    VerticaTableParameter,
)
from metadata.ingestion.source.database.vertica.lineage import VerticaLineageSource
from metadata.ingestion.source.database.vertica.metadata import VerticaSource
from metadata.ingestion.source.database.vertica.usage import VerticaUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=VerticaSource,
    lineage_source_class=VerticaLineageSource,
    usage_source_class=VerticaUsageSource,
    data_diff=VerticaTableParameter,  # pyright: ignore[reportArgumentType]
    connection_class=VerticaConnection,  # pyright: ignore[reportArgumentType]
)
