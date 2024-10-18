from metadata.ingestion.source.database.deltalake.metadata import DeltalakeSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DeltalakeSource)
