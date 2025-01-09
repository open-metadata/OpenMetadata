from metadata.ingestion.source.database.singlestore.lineage import (
    SinglestoreLineageSource,
)
from metadata.ingestion.source.database.singlestore.metadata import SinglestoreSource
from metadata.profiler.interface.sqlalchemy.single_store.profiler_interface import (
    SingleStoreProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=SinglestoreSource,
    profiler_class=SingleStoreProfilerInterface,
    lineage_source_class=SinglestoreLineageSource,
)
