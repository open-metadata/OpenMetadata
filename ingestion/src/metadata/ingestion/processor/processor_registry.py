from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.registry import Registry

processor_registry = Registry[Processor]()
processor_registry.load("metadata.ingestion.processor.plugins")



