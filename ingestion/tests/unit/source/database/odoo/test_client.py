import pytest
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
)
from metadata.ingestion.source.database.odoo.client import OdooApiException, OdooClient


@pytest.fixture
def odoo_connection():
    return OdooConnection(
        hostPort="http://localhost:8069",
        username="admin",
        password="password",
        databaseName="odoo",
    )


@patch("xmlrpc.client.ServerProxy")
def test_odoo_client_auth_success(mock_server_proxy, odoo_connection):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = 1
    mock_object = MagicMock()
    
    # We create two ServerProxy objects in the init: common and object
    mock_server_proxy.side_effect = [mock_common, mock_object]
    
    client = OdooClient(odoo_connection)
    
    assert client.uid == 1
    mock_common.authenticate.assert_called_once_with(
        "odoo", "admin", "password", {}
    )


@patch("xmlrpc.client.ServerProxy")
def test_odoo_client_auth_failure(mock_server_proxy, odoo_connection):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = False
    mock_object = MagicMock()
    
    mock_server_proxy.side_effect = [mock_common, mock_object]
    
    with pytest.raises(OdooApiException, match="Authentication failed: Odoo returned uid=False"):
        OdooClient(odoo_connection)


@patch("xmlrpc.client.ServerProxy")
def test_odoo_client_test_api(mock_server_proxy, odoo_connection):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = 1
    mock_object = MagicMock()
    mock_object.execute_kw.return_value = True
    
    mock_server_proxy.side_effect = [mock_common, mock_object]
    
    client = OdooClient(odoo_connection)
    result = client.test_api()
    
    assert result is True
    mock_object.execute_kw.assert_called_once_with(
        "odoo", 1, "password", "res.users", "check_access_rights", ["read"], {"raise_exception": False}
    )


@patch("xmlrpc.client.ServerProxy")
def test_odoo_client_test_api_failure(mock_server_proxy, odoo_connection):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = 1
    mock_object = MagicMock()
    mock_object.execute_kw.return_value = False
    
    mock_server_proxy.side_effect = [mock_common, mock_object]
    
    client = OdooClient(odoo_connection)
    with pytest.raises(OdooApiException, match="check_access_rights returned False"):
        client.test_api()


@patch("xmlrpc.client.ServerProxy")
def test_odoo_client_list_models(mock_server_proxy, odoo_connection):
    mock_common = MagicMock()
    mock_common.authenticate.return_value = 1
    mock_object = MagicMock()
    mock_object.execute_kw.return_value = [
        {"model": "res.partner", "name": "Partner"},
        {"model": "sale.order", "name": "Sales Order"},
    ]
    
    mock_server_proxy.side_effect = [mock_common, mock_object]
    
    client = OdooClient(odoo_connection)
    models = client.list_models()
    
    assert models == ["res.partner", "sale.order"]
    mock_object.execute_kw.assert_called_once_with(
        "odoo", 1, "password", "ir.model", "search_read", [[]], {"fields": ["name", "model", "info"], "limit": 100}
    )
