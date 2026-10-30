from metadata.ingestion.source.database.iomete.connection import IometeConnection
from metadata.ingestion.source.database.iomete.lineage import IometeLineageSource
from metadata.ingestion.source.database.iomete.metadata import IometeSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=IometeSource,
    lineage_source_class=IometeLineageSource,
    sampler_class="metadata.sampler.sqlalchemy.iomete.sampler.IometeSampler",
    test_suite_class="metadata.data_quality.interface.sqlalchemy.iomete.test_suite_interface.IometeTestSuiteInterface",
    profiler_class="metadata.profiler.interface.sqlalchemy.iomete.profiler_interface.IometeProfilerInterface",
    connection_class=IometeConnection,  # pyright: ignore[reportArgumentType]
)
