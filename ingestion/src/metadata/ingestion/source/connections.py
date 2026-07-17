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

"""
Main entrypoints to create and test connections
for any source.
"""

import traceback
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Callable, Optional, Type  # noqa: UP035

from pydantic import BaseModel

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.class_helper import get_service_type_from_source_type
from metadata.utils.importer import import_connection_fn
from metadata.utils.logger import cli_logger

logger = cli_logger()

GET_CONNECTION_FN_NAME = "get_connection"
TEST_CONNECTION_FN_NAME = "test_connection"


# TODO: This is a temporary solution to get the connection class from the service spec.
# Once we migrate all connectors we shouldn't need this.
def _get_connection_class_from_spec(
    connection: BaseModel,
) -> Optional[Type[BaseConnection]]:  # noqa: UP006, UP045
    """
    Helper method to get the connection class from the connection spec.
    Returns the connection class if successful, None otherwise.
    """
    from metadata.utils.service_spec.service_spec import (  # pylint: disable=import-outside-toplevel  # noqa: PLC0415
        BaseSpec,
        import_connection_class,
    )

    connection_type = getattr(connection, "type", None)
    if connection_type:
        service_type = get_service_type_from_source_type(connection_type.value)
        try:
            spec = BaseSpec.get_for_source(service_type, connection_type.value.lower())
            if getattr(spec, "connection_class", None):
                connection_class = import_connection_class(service_type, connection_type.value.lower())
                return connection_class  # noqa: RET504
        except Exception:
            logger.error(f"Error importing connection class for {connection_type.value}")
            logger.debug(traceback.format_exc())
    return None


def create_connection(connection: BaseModel) -> Optional[BaseConnection]:  # noqa: UP045
    """Return the ServiceSpec ``BaseConnection`` owner, or ``None`` if the
    connection has no ``connection_class``."""
    connection_class = _get_connection_class_from_spec(connection)
    return connection_class(connection) if connection_class else None


def run_test_connection(metadata: OpenMetadata, connection: BaseConnection) -> None:
    """Test an already-built connection owner, reusing its live client, and raise
    on failure. Does not close it; the source owns and closes the connection."""
    raise_test_connection_exception(connection.test_connection(metadata))


@contextmanager
def close_on_failure(connection: Optional[BaseConnection]) -> Iterator[None]:  # noqa: UP045
    """Release the owned connection if the wrapped verification fails."""
    try:
        yield
    except Exception:
        if connection is not None:
            connection.close()
        raise


def get_test_connection_fn(connection: BaseModel) -> Callable:
    """
    Build the test-connection function: the ServiceSpec ``connection_class`` when
    defined, else the source's legacy module-level ``test_connection``.
    """
    connection_class = _get_connection_class_from_spec(connection)
    if connection_class:

        def _test(metadata: OpenMetadata, *args, **kwargs):
            # BaseConnection.test_connection does not self-close; close the
            # temporary owner via the context manager once the test is done.
            with connection_class(connection) as owned:
                return owned.test_connection(metadata, *args, **kwargs)

        return _test
    return import_connection_fn(connection=connection, function_name=TEST_CONNECTION_FN_NAME)


def get_connection(connection: BaseModel) -> Any:
    """
    Prepare a client from a service connection: the ServiceSpec ``BaseConnection``
    client when defined, else the source's legacy module-level ``get_connection``.
    """
    owned = create_connection(connection)
    if owned is not None:
        return owned.client
    return import_connection_fn(connection=connection, function_name=GET_CONNECTION_FN_NAME)(connection)


def test_connection_common(metadata: OpenMetadata, connection_obj, service_connection):
    owned = create_connection(service_connection)
    if owned is not None:
        with owned:
            result = owned.test_connection(metadata)
    else:
        # Non-migrated / custom connector: legacy module-level test_connection.
        # Migrated connectors go through create_connection above, so the function
        # resolved here always takes the legacy (metadata, client, connection) args.
        test_connection_fn = get_test_connection_fn(service_connection)
        client = connection_obj if connection_obj is not None else get_connection(service_connection)
        result = test_connection_fn(metadata, client, service_connection)
    raise_test_connection_exception(result)
