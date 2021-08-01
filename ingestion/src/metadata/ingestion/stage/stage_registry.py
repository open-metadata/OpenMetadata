from metadata.ingestion.api.registry import Registry
from metadata.ingestion.api.stage import Stage

stage_registry = Registry[Stage]()
stage_registry.load("metadata.ingestion.stage.plugins")


