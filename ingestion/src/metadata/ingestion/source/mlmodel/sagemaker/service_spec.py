from metadata.ingestion.source.mlmodel.sagemaker.connection import SageMakerConnection
from metadata.ingestion.source.mlmodel.sagemaker.metadata import SagemakerSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SagemakerSource, connection_class=SageMakerConnection)  # pyright: ignore[reportArgumentType]
