"""Test Odoo Metadata Source"""
# pylint: disable=redefined-outer-name,protected-access,unused-argument

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Constraint, DataType, TableType
from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import Source
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.odoo.metadata import OdooSource


@pytest.fixture
def odoo_config():
    return Source(
        type="odoo",
        serviceName="test_odoo",
        serviceConnection={
            "config": OdooConnection(
                hostPort="http://localhost:8069",
                username="admin",
                password="password",
                databaseName="odoo",
            )
        },
        sourceConfig={
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    ).model_dump()


@patch("metadata.ingestion.source.database.odoo.metadata.OdooSource.test_connection")
@patch("metadata.ingestion.source.database.common_db_source.get_connection")
def test_odoo_source_topology(mock_get_connection, mock_test_connection, odoo_config):
    """Test the full ingestion topology of Odoo"""
    mock_metadata = MagicMock()

    # We mock the client that get_connection returns
    mock_client = MagicMock()
    mock_get_connection.return_value = mock_client

    source = OdooSource.create(odoo_config, mock_metadata)

    # Test get_database_names
    db_names = list(source.get_database_names())
    assert db_names == ["odoo"]

    # Test get_raw_database_schema_names
    schema_names = list(source.get_raw_database_schema_names())
    assert schema_names == ["default"]

    # Test get_tables_name_and_type
    mock_client.get_all_models.return_value = [
        {"model": "res.partner", "name": "Partner", "info": "Contact"},
        {"model": "sale.order", "name": "Sales Order", "info": "Sales"},
    ]

    tables = list(source.get_tables_name_and_type())
    assert len(tables) == 2
    assert tables[0] == ("res.partner", TableType.Regular)
    assert tables[1] == ("sale.order", TableType.Regular)
    assert source._model_descriptions["res.partner"] == "Partner"
    assert source._model_descriptions["sale.order"] == "Sales Order"

    # Test yield_table
    source.context.get().database = "odoo"
    source.context.get().database_schema = "default"
    source.context.get().database_service = "test_odoo"

    mock_client.get_model_fields.return_value = [
        {
            "name": "id",
            "field_description": "ID",
            "ttype": "integer",
            "required": True,
            "relation": False,
        },
        {
            "name": "name",
            "field_description": "Name",
            "ttype": "char",
            "required": True,
            "relation": False,
        },
        {
            "name": "company_id",
            "field_description": "Company",
            "ttype": "many2one",
            "required": False,
            "relation": "res.company",
        },
    ]

    requests = list(source.yield_table(("res.partner", TableType.Regular)))
    assert len(requests) == 1

    request_either = requests[0]
    assert isinstance(request_either, Either)
    assert request_either.right is not None

    table_request: CreateTableRequest = request_either.right
    assert table_request.name.root == "res.partner"
    assert table_request.description.root == "Partner"

    columns = table_request.columns
    assert len(columns) == 3

    assert columns[0].name.root == "id"
    assert columns[0].dataType == DataType.INT
    assert columns[0].dataTypeDisplay == "integer"
    assert columns[0].constraint == Constraint.NOT_NULL

    assert columns[1].name.root == "name"
    assert columns[1].dataType == DataType.VARCHAR
    assert columns[1].dataTypeDisplay == "char"

    assert columns[2].name.root == "company_id"
    assert columns[2].dataType == DataType.VARCHAR
    assert columns[2].dataTypeDisplay == "many2one (res.company)"
    assert columns[2].constraint == Constraint.NULL
