from metadata.ingestion.source.dashboard.qliksense.connection import QlikSenseConnection
from metadata.ingestion.source.dashboard.qliksense.metadata import QliksenseSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=QliksenseSource, connection_class=QlikSenseConnection)  # pyright: ignore[reportArgumentType]
