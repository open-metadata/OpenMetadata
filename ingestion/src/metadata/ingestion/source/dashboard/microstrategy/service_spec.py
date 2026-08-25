from metadata.ingestion.source.dashboard.microstrategy.connection import MicroStrategyConnection
from metadata.ingestion.source.dashboard.microstrategy.metadata import (
    MicrostrategySource,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MicrostrategySource, connection_class=MicroStrategyConnection)  # pyright: ignore[reportArgumentType]
