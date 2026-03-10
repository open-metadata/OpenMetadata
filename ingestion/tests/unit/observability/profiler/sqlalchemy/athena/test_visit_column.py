from unittest.mock import MagicMock, patch

import pytest

from metadata.profiler.interface.sqlalchemy.athena.profiler_interface import (
    _visit_column_with_struct_quoting,
)


@pytest.fixture
def compiler():
    mock = MagicMock()
    mock.preparer.quote_identifier.side_effect = lambda s: f'"{s}"'
    return mock


class TestVisitColumnWithStructQuoting:
    @patch("sqlalchemy.sql.compiler.SQLCompiler.visit_column")
    def test_visit_column_no_nesting(self, mock_visit_column, compiler):
        column = MagicMock()
        column.name = "customer_id"

        mock_visit_column.return_value = "customers_with_address.customer_id"
        assert (
            _visit_column_with_struct_quoting(compiler, column)
            == "customers_with_address.customer_id"
        )

        mock_visit_column.return_value = "customer_id"
        assert _visit_column_with_struct_quoting(compiler, column) == "customer_id"

    @patch("sqlalchemy.sql.compiler.SQLCompiler.visit_column")
    def test_visit_column_nesting(self, mock_visit_column, compiler):
        column = MagicMock()
        column.name = "address.street"

        mock_visit_column.return_value = "customers_with_address.address.street"
        assert (
            _visit_column_with_struct_quoting(compiler, column)
            == 'customers_with_address."address"."street"'
        )

        column.name = "address.geo.lat"
        mock_visit_column.return_value = "customers_with_address.address.geo.lat"
        assert (
            _visit_column_with_struct_quoting(compiler, column)
            == 'customers_with_address."address"."geo"."lat"'
        )

        column.name = "address.city"
        mock_visit_column.return_value = "address.city"
        assert _visit_column_with_struct_quoting(compiler, column) == '"address"."city"'
