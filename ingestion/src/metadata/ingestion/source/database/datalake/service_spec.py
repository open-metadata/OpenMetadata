from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DatalakeSource, profiler_class=PandasProfilerInterface
)
