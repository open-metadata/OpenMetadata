from metadata.ingestion.source.database.exasol.lineage import ExasolLineageSource
from metadata.ingestion.source.database.exasol.metadata import ExasolSource
from metadata.profiler.interface.sqlalchemy.exasol.profiler_interface import (
    ExasolProfilerInterface,
)
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    profiler_class=ExasolProfilerInterface,  # pyright: ignore[reportArgumentType]
    metadata_source_class=ExasolSource,
    lineage_source_class=ExasolLineageSource,
)
