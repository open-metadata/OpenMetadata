import unittest
from unittest.mock import MagicMock, patch

from pyhive.sqlalchemy_hive import HiveCompiler

from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)


class FakeHiveCompiler(
    DatabricksProfilerInterface,
    HiveCompiler,
):
    def __init__(self, service_connection_config):
        self.service_connection_config = service_connection_config


class TestDatabricksProfilerInterface(unittest.TestCase):
    @patch(
        "metadata.profiler.interface.sqlalchemy.databricks.profiler_interface.DatabricksProfilerInterface.set_catalog",
        return_value=None,
    )
    @patch(
        "metadata.profiler.interface.sqlalchemy.databricks.profiler_interface.DatabricksProfilerInterface.__init__",
        return_value=None,
    )
    @patch("pyhive.sqlalchemy_hive.HiveCompiler.visit_column")
    def setUp(
        self,
        mock_visit_column,
        mock_init,
        mock_set_catalog,
    ) -> None:
        self.profiler = FakeHiveCompiler(service_connection_config={})

    @patch("sqlalchemy.sql.compiler.SQLCompiler.visit_column")
    def test_visit_column_no_nesting(self, mock_visit_column_super):
        # Mock the response of the super class method
        mock_visit_column_super.return_value = "`db`.`schema`.`table`"
        assert self.profiler.visit_column(MagicMock()) == "`db`.`schema`.`table`"

        mock_visit_column_super.return_value = "`db`"
        assert self.profiler.visit_column(MagicMock()) == "`db`"

        mock_visit_column_super.return_value = "`schema`"
        assert self.profiler.visit_column(MagicMock()) == "`schema`"

        mock_visit_column_super.return_value = "`table`"
        assert self.profiler.visit_column(MagicMock()) == "`table`"

        mock_visit_column_super.return_value = "table"
        assert self.profiler.visit_column(MagicMock()) == "table"

    @patch("sqlalchemy.sql.compiler.SQLCompiler.visit_column")
    def test_visit_column_nesting(self, mock_visit_column_super):
        # Mock the response of the super class method
        mock_visit_column_super.return_value = "`db`.`schema`.`table`.`col.u.m.n`"
        assert (
            self.profiler.visit_column(MagicMock())
            == "`db`.`schema`.`table`.`col`.`u`.`m`.`n`"
        )

        mock_visit_column_super.return_value = "`db`.`schema`.`table`.`col.1`"
        assert (
            self.profiler.visit_column(MagicMock()) == "`db`.`schema`.`table`.`col`.`1`"
        )

        mock_visit_column_super.return_value = "`table`.`1.2`"
        assert self.profiler.visit_column(MagicMock()) == "`table`.`1`.`2`"

        # single dot in column name should not be split
        mock_visit_column_super.return_value = "`col.1`"
        assert self.profiler.visit_column(MagicMock()) == "`col.1`"
