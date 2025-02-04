from metadata.ingestion.source.search.elasticsearch.metadata import ElasticsearchSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=ElasticsearchSource)
