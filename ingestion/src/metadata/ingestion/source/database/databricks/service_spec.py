from metadata.ingestion.source.database.databricks.metadata import DatabricksSource
from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DatabricksSource, profiler_class=DatabricksProfilerInterface
)
