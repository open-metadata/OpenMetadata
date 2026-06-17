from metadata.ingestion.source.dashboard.sigma.connection import SigmaConnection
from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=SigmaSource, connection_class=SigmaConnection)  # pyright: ignore[reportArgumentType]
