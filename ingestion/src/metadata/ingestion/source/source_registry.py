from metadata.ingestion.api.registry import Registry
from metadata.ingestion.api.source import Source

source_registry = Registry[Source]()
source_registry.load("metadata.ingestion.source.plugins")

# This source is always enabled
