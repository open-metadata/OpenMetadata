from metadata.utils.service_spec.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class="not.implemented",
    lineage_source_class="metadata.ingestion.source.database.query.lineage.QueryLogLineageSource",
    usage_source_class="metadata.ingestion.source.database.query.usage.QueryLogUsageSource",
)
