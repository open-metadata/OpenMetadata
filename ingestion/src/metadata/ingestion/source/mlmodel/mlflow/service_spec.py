from metadata.ingestion.source.mlmodel.mlflow.connection import MlflowConnection
from metadata.ingestion.source.mlmodel.mlflow.metadata import MlflowSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MlflowSource, connection_class=MlflowConnection)  # pyright: ignore[reportArgumentType]
