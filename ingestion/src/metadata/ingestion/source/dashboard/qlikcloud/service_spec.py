from metadata.ingestion.source.dashboard.qlikcloud.metadata import QlikcloudSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=QlikcloudSource)
