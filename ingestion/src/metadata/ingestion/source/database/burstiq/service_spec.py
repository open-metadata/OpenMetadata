from metadata.ingestion.source.database.burstiq.lineage import BurstiqLineageSource
from metadata.ingestion.source.database.burstiq.metadata import Burstiqsource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=Burstiqsource, lineage_source_class=BurstiqLineageSource
)
