"""ClickZetta test-suite registration follows the standard SQLAlchemy contract."""

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.ingestion.source.database.clickzetta.service_spec import ServiceSpec
from metadata.utils.importer import get_class_path


def test_clickzetta_uses_the_standard_sqlalchemy_test_suite():
    assert ServiceSpec.test_suite_class == get_class_path(SQATestSuiteInterface)
