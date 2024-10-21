from metadata.ingestion.source.database.presto.metadata import PrestoSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=PrestoSource)
