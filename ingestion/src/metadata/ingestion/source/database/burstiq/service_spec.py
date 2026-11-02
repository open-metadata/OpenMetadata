from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.burstiq.metadata.Burstiqsource",
    lineage_source_class="metadata.ingestion.source.database.burstiq.lineage.BurstiqLineageSource",
    profiler_class="metadata.profiler.interface.pandas.burstiq.profiler_interface.BurstIQProfilerInterface",
    test_suite_class="metadata.data_quality.interface.pandas.pandas_test_suite_interface.PandasTestSuiteInterface",
    sampler_class="metadata.sampler.pandas.burstiq.sampler.BurstIQSampler",
    connection_class="metadata.ingestion.source.database.burstiq.connection.BurstIQConnection",
)
