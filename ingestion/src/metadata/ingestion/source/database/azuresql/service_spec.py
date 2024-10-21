from metadata.ingestion.source.database.azuresql.metadata import AzuresqlSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=AzuresqlSource)
