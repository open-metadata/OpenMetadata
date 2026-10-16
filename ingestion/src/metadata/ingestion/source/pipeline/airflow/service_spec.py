from metadata.ingestion.source.pipeline.airflow.connection import AirflowConnection
from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=AirflowSource, connection_class=AirflowConnection)  # pyright: ignore[reportArgumentType]
