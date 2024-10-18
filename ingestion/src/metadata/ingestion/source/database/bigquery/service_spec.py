from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.profiler.interface.sqlalchemy.bigquery.profiler_interface import (
    BigQueryProfilerInterface,
)
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=BigquerySource, profiler_class=BigQueryProfilerInterface
)
