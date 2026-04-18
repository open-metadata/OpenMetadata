from metadata.ingestion.source.database.supabase.lineage import SupabaseLineageSource
from metadata.ingestion.source.database.supabase.metadata import SupabaseSource
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SupabaseSource,
    lineage_source_class=SupabaseLineageSource,
)
