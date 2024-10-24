from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=RedpandaSource)
