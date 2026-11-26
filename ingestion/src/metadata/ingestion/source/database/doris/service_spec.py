from metadata.ingestion.source.database.doris.connection import DorisConnection
from metadata.ingestion.source.database.doris.lineage import DorisLineageSource
from metadata.ingestion.source.database.doris.metadata import DorisSource
from metadata.ingestion.source.database.doris.usage import DorisUsageSource
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DorisSource,
    lineage_source_class=DorisLineageSource,
    usage_source_class=get_class_path(DorisUsageSource),
    connection_class=DorisConnection,  # pyright: ignore[reportArgumentType]
)
