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
Validate connection builder utilities
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.connections.builders import (
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)


class ConnectionBuilderTest(TestCase):
    """
    Assert utility functions
    """

    connection = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
    )

    connection_with_args = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
        connectionArguments={"hello": "world"},
    )

    connection_with_options = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
        connectionOptions={"hello": "world"},
    )

    def test_get_connection_args_common(self):
        """
        With null and existing params
        """
        self.assertEqual(get_connection_args_common(self.connection), {})
        self.assertEqual(
            get_connection_args_common(self.connection_with_args), {"hello": "world"}
        )

    def test_get_connection_options_dict(self):
        """
        Will null and existing params
        """
        self.assertIsNone(get_connection_options_dict(self.connection))
        self.assertEqual(
            get_connection_options_dict(self.connection_with_options),
            {"hello": "world"},
        )

    def test_init_empty_connection_arguments(self):
        """
        To allow easy key handling
        """
        new_args = init_empty_connection_arguments()
        new_args.__root__["hello"] = "world"

        self.assertEqual(new_args.__root__.get("hello"), "world")
        self.assertIsNone(new_args.__root__.get("not there"))
