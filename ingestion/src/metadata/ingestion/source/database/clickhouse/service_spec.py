from metadata.ingestion.source.database.clickhouse.metadata import ClickhouseSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=ClickhouseSource)
