"""ClickZetta service specification."""

from metadata.data_quality.interface.sqlalchemy.clickzetta.test_suite_interface import (
    ClickzettaTestSuiteInterface,
)
from metadata.ingestion.source.database.clickzetta.connection import (
    ClickzettaConnection,
)
from metadata.ingestion.source.database.clickzetta.data_diff.table_parameter import (
    ClickzettaTableParameter,
)
from metadata.ingestion.source.database.clickzetta.lineage import (
    ClickzettaLineageSource,
)
from metadata.ingestion.source.database.clickzetta.metadata import (
    ClickzettaSource,
)
from metadata.ingestion.source.database.clickzetta.usage import (
    ClickzettaUsageSource,
)
from metadata.profiler.interface.sqlalchemy.clickzetta.profiler_interface import (
    ClickzettaProfilerInterface,
)
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=get_class_path(ClickzettaSource),
    lineage_source_class=get_class_path(ClickzettaLineageSource),
    usage_source_class=get_class_path(ClickzettaUsageSource),
    connection_class=get_class_path(ClickzettaConnection),
    profiler_class=get_class_path(ClickzettaProfilerInterface),
    sampler_class=get_class_path(ClickzettaSampler),
    test_suite_class=get_class_path(ClickzettaTestSuiteInterface),
    data_diff=ClickzettaTableParameter,
)
