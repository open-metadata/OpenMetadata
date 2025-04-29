from metadata.ingestion.source.database.bigquery.lineage import BigqueryLineageSource
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.ingestion.source.database.bigquery.profiler.profiler import (
    BigQueryProfiler,
)
from metadata.ingestion.source.database.bigquery.usage import BigqueryUsageSource
from metadata.sampler.sqlalchemy.bigquery.sampler import BigQuerySampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=BigquerySource,
    lineage_source_class=BigqueryLineageSource,
    usage_source_class=BigqueryUsageSource,
    profiler_class=BigQueryProfiler,
    sampler_class=BigQuerySampler,
)
