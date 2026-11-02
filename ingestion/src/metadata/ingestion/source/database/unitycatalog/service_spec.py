from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class="metadata.ingestion.source.database.unitycatalog.metadata.UnitycatalogSource",
    lineage_source_class="metadata.ingestion.source.database.unitycatalog.lineage.UnitycatalogLineageSource",
    usage_source_class="metadata.ingestion.source.database.unitycatalog.usage.UnitycatalogUsageSource",
    profiler_class="metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface.UnityCatalogProfilerInterface",
    test_suite_class="metadata.data_quality.interface.sqlalchemy.unity_catalog.test_suite_interface.UnityCatalogTestSuiteInterface",
    sampler_class="metadata.sampler.sqlalchemy.unitycatalog.sampler.UnityCatalogSamplerInterface",
    data_diff="metadata.ingestion.source.database.unitycatalog.data_diff.data_diff.UnityCatalogTableParameter",
    connection_class="metadata.ingestion.source.database.unitycatalog.connection.UnityCatalogConnection",
)
