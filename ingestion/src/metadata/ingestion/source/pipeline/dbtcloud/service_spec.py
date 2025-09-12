from metadata.ingestion.source.pipeline.dbtcloud.metadata import DbtcloudSource
from metadata.ingestion.source.pipeline.dbtcloud.profiler import DBTCloudProfilerSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(
    metadata_source_class=DbtcloudSource, profiler_source_class=DBTCloudProfilerSource
)
