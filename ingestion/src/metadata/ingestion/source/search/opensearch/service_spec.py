from metadata.ingestion.source.search.opensearch.metadata import OpensearchSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=OpensearchSource)
