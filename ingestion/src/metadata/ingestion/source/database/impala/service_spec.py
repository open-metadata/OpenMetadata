from metadata.ingestion.source.database.impala.metadata import ImpalaSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=ImpalaSource)
