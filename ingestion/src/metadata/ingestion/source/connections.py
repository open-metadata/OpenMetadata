#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Main entrypoints to create and test connections
for any source.
"""
from typing import Any, Callable

from pydantic import BaseModel

from metadata.utils.importer import import_connection_fn

GET_CONNECTION_FN_NAME = "get_connection"
TEST_CONNECTION_FN_NAME = "test_connection"


def get_connection_fn(connection: BaseModel) -> Callable:
    """
    Import the get_connection function from the source
    """
    return import_connection_fn(
        connection=connection, function_name=GET_CONNECTION_FN_NAME
    )


def get_test_connection_fn(connection: BaseModel) -> Callable:
    """
    Import the test_connection function from the source
    """
    return import_connection_fn(
        connection=connection, function_name=TEST_CONNECTION_FN_NAME
    )


def get_connection(connection: BaseModel) -> Any:
    """
    Main method to prepare a connection from
    a service connection pydantic model
    """
    return get_connection_fn(connection)(connection)
