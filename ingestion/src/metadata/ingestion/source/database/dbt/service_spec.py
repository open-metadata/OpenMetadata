from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=DbtSource)
