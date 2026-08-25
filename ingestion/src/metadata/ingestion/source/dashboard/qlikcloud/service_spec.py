from metadata.ingestion.source.dashboard.qlikcloud.connection import QlikCloudConnection
from metadata.ingestion.source.dashboard.qlikcloud.metadata import QlikcloudSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=QlikcloudSource, connection_class=QlikCloudConnection)  # pyright: ignore[reportArgumentType]
