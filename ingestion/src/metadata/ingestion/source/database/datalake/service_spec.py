from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.datalake.metadata.DatalakeSource",
    profiler_class="metadata.profiler.interface.pandas.profiler_interface.PandasProfilerInterface",
    test_suite_class="metadata.data_quality.interface.pandas.pandas_test_suite_interface.PandasTestSuiteInterface",
    sampler_class="metadata.sampler.pandas.sampler.DatalakeSampler",
    connection_class="metadata.ingestion.source.database.datalake.connection.DatalakeConnection",
)
