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

    spec = DefaultDatabaseSpec(metadata_source_class=MysqlSource, connection_class=MySQLConnection)
    assert spec.connection_class == get_class_path(MySQLConnection)


def test_default_spec_loaders_preserve_the_registered_implementations():
    from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
    from metadata.generated.schema.entity.services.serviceType import ServiceType
    from metadata.sampler.sqlalchemy.sampler import SQASampler
    from metadata.utils.service_spec.service_spec import (
        import_connection_class,
        import_profiler_class,
        import_sampler_class,
        import_test_suite_class,
    )

    assert import_connection_class(ServiceType.Database, "mysql") is MySQLConnection
    assert import_profiler_class(ServiceType.Database, "mysql") is SQAProfilerInterface
    assert import_sampler_class(ServiceType.Database, "mysql") is SQASampler
    assert import_test_suite_class(ServiceType.Database, "mysql") is SQATestSuiteInterface


def test_timescale_source_public_import_remains_available():
    from metadata.generated.schema.entity.services.serviceType import ServiceType
    from metadata.ingestion.source.database.timescale import TimescaleSource
    from metadata.utils.service_spec.service_spec import import_source_class

    assert import_source_class(ServiceType.Database, "timescale") is TimescaleSource
