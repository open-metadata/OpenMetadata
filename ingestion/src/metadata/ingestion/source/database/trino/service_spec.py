from metadata.ingestion.source.database.trino.metadata import TrinoSource
from metadata.profiler.interface.sqlalchemy.trino.profiler_interface import (
    TrinoProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=TrinoSource, profiler_class=TrinoProfilerInterface
)
