from metadata.ingestion.source.pipeline.datafactory.metadata import DataFactorySource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DataFactorySource)
