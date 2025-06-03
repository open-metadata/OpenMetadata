from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.profiler.interface.pandas.profiler_interface import (
    PandasProfilerInterface,
)
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=DatalakeSource,
    profiler_class=PandasProfilerInterface,
    test_suite_class=PandasTestSuiteInterface,
    sampler_class=DatalakeSampler,
)
