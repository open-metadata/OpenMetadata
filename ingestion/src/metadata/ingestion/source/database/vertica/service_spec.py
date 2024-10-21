from metadata.ingestion.source.database.vertica.metadata import VerticaSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=VerticaSource, profiler_class=None
)
