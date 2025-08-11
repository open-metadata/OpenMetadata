from metadata.ingestion.source.database.mariadb.lineage import MariadbLineageSource
from metadata.ingestion.source.database.mariadb.metadata import MariadbSource
from metadata.profiler.interface.sqlalchemy.mariadb.profiler_interface import (
    MariaDBProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=MariadbSource,
    lineage_source_class=MariadbLineageSource,
    profiler_class=MariaDBProfilerInterface,
)
