from metadata.ingestion.source.database.db2.lineage import Db2LineageSource
from metadata.ingestion.source.database.db2.metadata import Db2Source
from metadata.profiler.interface.sqlalchemy.db2.profiler_interface import (
    DB2ProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=Db2Source,
    profiler_class=DB2ProfilerInterface,
    lineage_source_class=Db2LineageSource,
)
