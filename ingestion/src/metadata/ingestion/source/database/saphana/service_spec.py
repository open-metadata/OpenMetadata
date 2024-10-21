from metadata.ingestion.source.database.saphana.metadata import SaphanaSource
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(metadata_source_class=SaphanaSource)
