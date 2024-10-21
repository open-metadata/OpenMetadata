from metadata.ingestion.source.database.clickhouse.metadata import ClickhouseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=ClickhouseSource)
