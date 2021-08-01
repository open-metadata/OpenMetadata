from metadata.ingestion.api.bulk_sink import BulkSink
from metadata.ingestion.api.registry import Registry

bulk_sink_registry = Registry[BulkSink]()
bulk_sink_registry.load("metadata.ingestion.bulksink.plugins")


