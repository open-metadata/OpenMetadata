#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import importlib
import sys
from collections.abc import Callable
from contextlib import ExitStack
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic import SecretStr
from sqlalchemy.engine import Engine

import metadata.ingestion.source.database as database_source_package
from metadata.ingestion.connections.builders import get_connection_args_common

database_source_package.__path__.append(
    str(Path(__file__).resolve().parents[4] / "src/metadata/ingestion/source/database")
)

_CLICKZETTA_CONFIG_MODULE = "metadata.generated.schema.entity.services.connections.database.clickzettaConnection"
try:
    importlib.import_module(_CLICKZETTA_CONFIG_MODULE)
except ModuleNotFoundError:
    generated_module = ModuleType(_CLICKZETTA_CONFIG_MODULE)
    generated_module.ClickzettaConnection = object
    sys.modules[_CLICKZETTA_CONFIG_MODULE] = generated_module

# The read-only overlay extends the installed package path before these imports.
from metadata.ingestion.source.database.clickzetta.connection import (  # noqa: E402
    ClickzettaConnection,
    get_clickzetta_connection_url,
)
from metadata.ingestion.source.database.clickzetta.service_spec import (  # noqa: E402
    ServiceSpec,
)
from metadata.ingestion.source.database.clickzetta.url import (  # noqa: E402
    build_clickzetta_url,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.clickzetta.connection"


class _ConcreteClickzettaConnection(ClickzettaConnection):
    """Satisfy the ingestion image's legacy abstract test interface."""

    def __init__(self, service_connection):
        super().__init__(service_connection)
        if not hasattr(self, "_closing"):
            self._closing = ExitStack()

    def get_connection_dict(self):
        return {}

    if not hasattr(ClickzettaConnection, "_on_close"):

        def _on_close(self, teardown: Callable[[], None]) -> None:
            self._closing.callback(teardown)

    if not hasattr(ClickzettaConnection, "close"):

        def close(self) -> None:
            self._closing.close()
            self._closing = ExitStack()
            self._client = None


def _connection_config(connection_options=None):
    return SimpleNamespace(
        hostPort="instance.example.clickzetta.test",
        username="catalog_reader",
        authType=SimpleNamespace(password=SecretStr("secret")),
        databaseName="quick_start",
        virtualCluster="DEFAULT",
        databaseSchema=None,
        protocol=SimpleNamespace(value="https"),
        connectionOptions=(SimpleNamespace(root=connection_options) if connection_options is not None else None),
        connectionArguments=None,
    )


def test_service_spec_disables_non_metadata_capabilities():
    assert ServiceSpec.profiler_class is None
    assert ServiceSpec.sampler_class is None
    assert ServiceSpec.test_suite_class is None
    assert ServiceSpec.data_diff is None


def test_clickzetta_connection_uses_common_builder():
    engine = MagicMock(spec=Engine)
    connection_config = _connection_config()

    with (
        patch(
            f"{CONNECTION_MODULE}.create_generic_db_connection",
            return_value=engine,
            create=True,
        ) as common_builder,
        patch(
            f"{CONNECTION_MODULE}.create_engine",
            return_value=engine,
            create=True,
        ),
    ):
        connection = _ConcreteClickzettaConnection(connection_config)
        assert connection.client is engine

    common_builder.assert_called_once()
    assert common_builder.call_args.kwargs["connection"] is connection_config
    assert common_builder.call_args.kwargs["get_connection_args_fn"] is get_connection_args_common
    assert common_builder.call_args.kwargs["get_connection_url_fn"].__name__ == "get_clickzetta_connection_url"


def test_clickzetta_connection_propagates_generated_connection_options():
    engine = MagicMock(spec=Engine)
    connection_config = _connection_config(
        {
            "warehouse": "metadata",
            "connect_timeout": "30",
        }
    )
    captured_url = None

    def build_engine(**kwargs):
        nonlocal captured_url
        captured_url = kwargs["get_connection_url_fn"](kwargs["connection"])
        return engine

    with (
        patch(
            f"{CONNECTION_MODULE}.create_generic_db_connection",
            side_effect=build_engine,
            create=True,
        ) as common_builder,
        patch(
            f"{CONNECTION_MODULE}.create_engine",
            return_value=engine,
            create=True,
        ),
    ):
        connection = _ConcreteClickzettaConnection(connection_config)
        assert connection.client is engine

    common_builder.assert_called_once()
    assert dict(captured_url.query) == {
        "virtualcluster": "DEFAULT",
        "warehouse": "metadata",
        "connect_timeout": "30",
    }


def test_clickzetta_connection_close_disposes_owned_engine():
    engine = MagicMock(spec=Engine)
    connection_config = _connection_config()

    with (
        patch(
            f"{CONNECTION_MODULE}.create_generic_db_connection",
            return_value=engine,
            create=True,
        ),
        patch(
            f"{CONNECTION_MODULE}.create_engine",
            return_value=engine,
            create=True,
        ),
        patch(
            f"{CONNECTION_MODULE}.get_connection_args_common",
            return_value={},
        ),
    ):
        connection = _ConcreteClickzettaConnection(connection_config)
        assert connection.client is engine
        connection.close()

    engine.dispose.assert_called_once_with()


def test_clickzetta_connection_requires_a_password():
    connection_config = _connection_config()
    connection_config.authType.password = None

    with pytest.raises(ValueError, match="password"):
        get_clickzetta_connection_url(connection_config)


def test_clickzetta_connection_defaults_to_https_when_protocol_is_absent():
    connection_config = _connection_config()
    connection_config.protocol = None

    url = get_clickzetta_connection_url(connection_config)

    assert "protocol" not in dict(url.query)


def test_clickzetta_connection_exposes_a_data_diff_connection_dict():
    connection = object.__new__(ClickzettaConnection)
    connection._client = SimpleNamespace(
        url=build_clickzetta_url(
            host_port="instance.example.clickzetta.test:8443",
            username="catalog_reader",
            password="secret",
            workspace="quick_start",
            virtual_cluster="DEFAULT",
            database_schema="seller_center",
            protocol="https",
            connection_options={"warehouse": "metadata"},
        )
    )
    connection.service_connection = SimpleNamespace(connectionArguments=SimpleNamespace(root={"timeout": "5"}))

    connection_dict = ClickzettaConnection.get_connection_dict(connection)

    assert connection_dict == {
        "driver": "clickzetta",
        "host": "instance.example.clickzetta.test",
        "port": 8443,
        "user": "catalog_reader",
        "password": "secret",
        "workspace": "quick_start",
        "virtualcluster": "DEFAULT",
        "schema": "seller_center",
        "warehouse": "metadata",
        "timeout": "5",
    }


def test_build_clickzetta_url_preserves_workspace_and_virtual_cluster():
    url = build_clickzetta_url(
        host_port="instance.example.clickzetta.test",
        username="catalog_reader",
        password="p@ss/word",
        workspace="quick_start",
        virtual_cluster="DEFAULT",
        database_schema="rpt",
        protocol="https",
    )

    rendered = url.render_as_string(hide_password=False)
    assert rendered.startswith("clickzetta://catalog_reader:p%40ss%2Fword@instance.example.clickzetta.test/quick_start")
    assert dict(url.query) == {
        "virtualcluster": "DEFAULT",
        "schema": "rpt",
    }


def test_build_clickzetta_url_adds_http_protocol_only_when_requested():
    url = build_clickzetta_url(
        host_port="instance.example.clickzetta.test:8443",
        username="catalog_reader",
        password="secret",
        workspace="quick_start",
        virtual_cluster="DEFAULT",
        database_schema=None,
        protocol="http",
    )

    assert url.host == "instance.example.clickzetta.test"
    assert url.port == 8443
    assert dict(url.query) == {
        "virtualcluster": "DEFAULT",
        "protocol": "http",
    }


def test_build_clickzetta_url_merges_custom_connection_options():
    url = build_clickzetta_url(
        host_port="instance.example.clickzetta.test",
        username="catalog_reader",
        password="secret",
        workspace="quick_start",
        virtual_cluster="DEFAULT",
        database_schema=None,
        protocol="https",
        connection_options={
            "warehouse": "metadata",
            "connect_timeout": "30",
        },
    )

    assert dict(url.query) == {
        "virtualcluster": "DEFAULT",
        "warehouse": "metadata",
        "connect_timeout": "30",
    }


@pytest.mark.parametrize(
    "reserved_key",
    [
        "virtualcluster",
        "schema",
        "protocol",
    ],
)
def test_build_clickzetta_url_rejects_reserved_connection_options(
    reserved_key,
):
    with pytest.raises(ValueError, match=reserved_key):
        build_clickzetta_url(
            host_port="instance.example.clickzetta.test",
            username="catalog_reader",
            password="secret",
            workspace="quick_start",
            virtual_cluster="DEFAULT",
            database_schema=None,
            protocol="https",
            connection_options={reserved_key: "override"},
        )


def test_build_clickzetta_url_rejects_an_invalid_host_port():
    with pytest.raises(ValueError, match="hostPort"):
        build_clickzetta_url(
            host_port="instance.example.clickzetta.test:not-a-port",
            username="catalog_reader",
            password="secret",
            workspace="quick_start",
            virtual_cluster="DEFAULT",
            database_schema=None,
            protocol="https",
        )
