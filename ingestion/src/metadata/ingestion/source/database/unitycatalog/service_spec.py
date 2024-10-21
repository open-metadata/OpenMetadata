from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource
from metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface import (
    UnityCatalogProfilerInterface,
)
from metadata.utils.manifest import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=UnitycatalogSource,
    profiler_class=UnityCatalogProfilerInterface,
)
