from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.ingestion.source.database.burstiq.lineage import BurstiqLineageSource
from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource
from metadata.profiler.interface.pandas.burstiq.profiler_interface import (
    BurstIQProfilerInterface,
)
from metadata.sampler.pandas.burstiq.sampler import BurstIQSampler
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=Burstiqsource,
    lineage_source_class=BurstiqLineageSource,
    profiler_class=BurstIQProfilerInterface,
    test_suite_class=PandasTestSuiteInterface,
    sampler_class=BurstIQSampler,
)
