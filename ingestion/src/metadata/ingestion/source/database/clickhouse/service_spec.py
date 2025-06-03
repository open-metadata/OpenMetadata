from metadata.ingestion.source.database.clickhouse.lineage import (
    ClickhouseLineageSource,
)
from metadata.ingestion.source.database.clickhouse.metadata import ClickhouseSource
from metadata.ingestion.source.database.clickhouse.usage import ClickhouseUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=ClickhouseSource,
    lineage_source_class=ClickhouseLineageSource,
    usage_source_class=ClickhouseUsageSource,
)
