from sqlalchemy.dialects import registry

from .dialect import HivePostgresMetaStoreDialect

__version__ = "0.1.0"
registry.register(
    "hive.postgres",
    "metadata.ingestion.source.database.hive.metastore_dialects.postgres.dialect",
    "HivePostgresMetaStoreDialect",
)
