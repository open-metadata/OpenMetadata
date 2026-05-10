"""Test Odoo Connection"""
# pylint: disable=redefined-outer-name

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
    OdooType,
)
from metadata.ingestion.source.database.odoo import connection as odoo_connection_module
from metadata.ingestion.source.database.odoo.client import OdooClient
from metadata.ingestion.source.database.odoo.connection import get_connection


@pytest.fixture
def odoo_connection():
    return OdooConnection(
        hostPort="http://localhost:8069",
        username="admin",
        password="password",
        databaseName="odoo",
        type=OdooType.Odoo,
    )


@patch("metadata.ingestion.source.database.odoo.connection.OdooClient")
def test_get_connection(mock_odoo_client, odoo_connection):
    client = get_connection(odoo_connection)
    assert client == mock_odoo_client.return_value
    mock_odoo_client.assert_called_once_with(odoo_connection)


@patch("metadata.ingestion.source.database.odoo.connection.test_connection_steps")
def test_odoo_test_connection(mock_test_connection_steps, odoo_connection):
    mock_metadata = MagicMock()
    mock_client = MagicMock(spec=OdooClient)

    odoo_connection_module.test_connection(
        metadata=mock_metadata,
        client=mock_client,
        service_connection=odoo_connection,
        automation_workflow=None,
    )

    mock_test_connection_steps.assert_called_once_with(
        metadata=mock_metadata,
        test_fn={
            "CheckAccess": mock_client.test_api,
            "GetModels": mock_client.list_models,
        },
        service_type="Odoo",
        automation_workflow=None,
        timeout_seconds=180,
    )
