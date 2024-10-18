from metadata.ingestion.source.database.druid.metadata import DruidSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DruidSource)
