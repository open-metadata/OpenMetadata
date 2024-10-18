from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MssqlSource)
