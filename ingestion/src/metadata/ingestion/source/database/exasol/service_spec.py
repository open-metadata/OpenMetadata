from metadata.ingestion.source.database.exasol.metadata import ExasolSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=ExasolSource)
