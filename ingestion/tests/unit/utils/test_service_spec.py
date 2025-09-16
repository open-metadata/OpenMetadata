from metadata.ingestion.source.database.mysql.connection import MySQLConnection
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec import BaseSpec
from metadata.utils.service_spec.default import DefaultDatabaseSpec


def test_service_spec():
    spec = BaseSpec(metadata_source_class=MysqlSource)
    assert spec.metadata_source_class == get_class_path(MysqlSource)

    spec = DefaultDatabaseSpec(metadata_source_class=MysqlSource)
    assert spec.metadata_source_class == get_class_path(MysqlSource)
    assert spec.profiler_class == get_class_path(SQAProfilerInterface)

    spec = DefaultDatabaseSpec(
        metadata_source_class=MysqlSource, connection_class=MySQLConnection
    )
    assert spec.connection_class == get_class_path(MySQLConnection)
