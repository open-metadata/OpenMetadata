from metadata.ingestion.source.database.redshift.lineage import RedshiftLineageSource
from metadata.ingestion.source.database.redshift.metadata import RedshiftSource
from metadata.ingestion.source.database.redshift.profiler.profiler import (
    RedshiftProfiler,
)
from metadata.ingestion.source.database.redshift.usage import RedshiftUsageSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=RedshiftSource,
    lineage_source_class=RedshiftLineageSource,
    usage_source_class=RedshiftUsageSource,
    profiler_class=RedshiftProfiler,
)
