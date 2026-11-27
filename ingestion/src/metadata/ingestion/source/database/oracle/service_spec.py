from metadata.ingestion.source.database.oracle.connection import OracleConnection
from metadata.ingestion.source.database.oracle.lineage import OracleLineageSource
from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.ingestion.source.database.oracle.usage import OracleUsageSource
from metadata.sampler.sqlalchemy.oracle.sampler import OracleSampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.default import DefaultDatabaseSpec

ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=OracleSource,
    lineage_source_class=OracleLineageSource,
    usage_source_class=OracleUsageSource,
    sampler_class=get_class_path(OracleSampler),
    connection_class=OracleConnection,
)
