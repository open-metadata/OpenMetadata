from metadata.ingestion.api.registry import Registry
from metadata.ingestion.api.sink import Sink

sink_registry = Registry[Sink]()
sink_registry.load("metadata.ingestion.sink.plugins")
# These sinks are always enabled
assert sink_registry.get("file")
