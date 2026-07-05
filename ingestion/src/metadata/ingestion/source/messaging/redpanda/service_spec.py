from metadata.ingestion.source.messaging.redpanda.connection import RedpandaConnection
from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=RedpandaSource, connection_class=RedpandaConnection)  # pyright: ignore[reportArgumentType]
