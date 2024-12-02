from metadata.ingestion.source.dashboard.microstrategy.metadata import (
    MicrostrategySource,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=MicrostrategySource)
