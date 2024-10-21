from metadata.ingestion.source.mlmodel.mlflow.metadata import MlflowSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=MlflowSource)
