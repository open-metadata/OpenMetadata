from metadata.ingestion.source.database.query.lineage import QueryLogLineageSource
from metadata.ingestion.source.database.query.usage import QueryLogUsageSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class="not.implemented",
    lineage_source_class=QueryLogLineageSource,
    usage_source_class=QueryLogUsageSource,
)
