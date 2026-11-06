from metadata.ingestion.source.dashboard.tableau.connection import TableauConnection
from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class=TableauSource, connection_class=TableauConnection)  # pyright: ignore[reportArgumentType]
