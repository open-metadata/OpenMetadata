from metadata.ingestion.source.database.unitycatalog.lineage import (
    UnitycatalogLineageSource,
)
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource
from metadata.ingestion.source.database.unitycatalog.usage import (
    UnitycatalogUsageSource,
)
from metadata.profiler.interface.sqlalchemy.unity_catalog.profiler_interface import (
    UnityCatalogProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=UnitycatalogSource,
    lineage_source_class=UnitycatalogLineageSource,
    usage_source_class=UnitycatalogUsageSource,
    profiler_class=UnityCatalogProfilerInterface,
)
