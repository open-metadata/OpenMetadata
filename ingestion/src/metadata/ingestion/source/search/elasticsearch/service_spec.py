from metadata.ingestion.source.search.elasticsearch.connection import ElasticsearchConnection
from metadata.ingestion.source.search.elasticsearch.metadata import ElasticsearchSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=ElasticsearchSource, connection_class=ElasticsearchConnection)  # pyright: ignore[reportArgumentType]
