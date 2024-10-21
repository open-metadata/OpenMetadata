from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=GlueSource)
