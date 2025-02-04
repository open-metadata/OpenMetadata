from metadata.ingestion.source.mlmodel.sagemaker.metadata import SagemakerSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SagemakerSource)
