from metadata.ingestion.source.pipeline.dagster.metadata import DagsterSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=DagsterSource)
