from metadata.data_quality.interface.sqlalchemy.databricks.test_suite_interface import (
    DatabricksTestSuiteInterface,
)
from metadata.ingestion.source.database.databricks.lineage import (
    DatabricksLineageSource,
)
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource
from metadata.ingestion.source.database.databricks.usage import DatabricksUsageSource
from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DatabricksSource,
    lineage_source_class=DatabricksLineageSource,
    usage_source_class=DatabricksUsageSource,
    profiler_class=DatabricksProfilerInterface,
    test_suite_class=DatabricksTestSuiteInterface,
)
