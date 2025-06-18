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
from typing import Any, Callable, Optional, Type

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
) -> Optional[Type[BaseConnection]]:
    """
    Helper method to get the connection class from the connection spec.
    Returns the connection class if successful, None otherwise.
    """
    from metadata.utils.service_spec.service_spec import (  # pylint: disable=import-outside-toplevel
        BaseSpec,
        import_connection_class,
    )

    connection_type = getattr(connection, "type", None)
    if connection_type:
        service_type = get_service_type_from_source_type(connection_type.value)
        try:
            spec = BaseSpec.get_for_source(service_type, connection_type.value.lower())
            if getattr(spec, "connection_class", None):
                connection_class = import_connection_class(
                    service_type, connection_type.value.lower()
                )
                return connection_class
        except Exception:
            logger.error(
                f"Error importing connection class for {connection_type.value}"
            )
            logger.debug(traceback.format_exc())
    return None


def _get_connection_fn_from_service_spec(connection: BaseModel) -> Optional[Callable]:
    """
    Import the get_connection function from the source, or use ServiceSpec connection_class if defined.
    """
    connection_class = _get_connection_class_from_spec(connection)
    if connection_class:

        def _get_client(conn):
            return connection_class(conn).get_client()

        return _get_client
    return None


def _get_test_fn_from_service_spec(connection: BaseModel) -> Optional[Callable]:
    """
    Import the get_connection function from the source, or use ServiceSpec connection_class if defined.
    """
    connection_class = _get_connection_class_from_spec(connection)
    if connection_class:
        return connection_class(connection).test_connection
    return None


def get_connection_fn(connection: BaseModel) -> Callable:
    """
    Import the get_connection function from the source, or use ServiceSpec connection_class if defined.
    """
    # Try ServiceSpec path first
    connection_fn = _get_connection_fn_from_service_spec(connection)
    if connection_fn:
        return connection_fn
    # Fallback to default
    return import_connection_fn(
        connection=connection, function_name=GET_CONNECTION_FN_NAME
    )


def get_test_connection_fn(connection: BaseModel) -> Callable:
    """
    Import the test_connection function from the source
    """
    test_fn = _get_test_fn_from_service_spec(connection)
    if test_fn:
        return test_fn
    # Fallback to default
    return import_connection_fn(
        connection=connection, function_name=TEST_CONNECTION_FN_NAME
    )


def get_connection(connection: BaseModel) -> Any:
    """
    Main method to prepare a connection from
    a service connection pydantic model
    """
    return get_connection_fn(connection)(connection)


def test_connection_common(metadata: OpenMetadata, connection_obj, service_connection):
    test_connection_fn = get_test_connection_fn(service_connection)
    # TODO: Remove this once we migrate all connectors to use the new test connection function
    try:
        result = test_connection_fn(metadata)
    except TypeError:
        result = test_connection_fn(metadata, connection_obj, service_connection)
    raise_test_connection_exception(result)
