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
Get and test connection utilities
"""
from typing import Any, Dict, Optional

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
    ConnectionOptions,
)
from metadata.ingestion.connections.secrets import connection_with_options_secrets


@connection_with_options_secrets
def get_connection_args_common(connection) -> Dict[str, Any]:
    """
    Read the connection arguments of a connection.

    Any function operating on top of the connection
    arguments should be decorated with `connection_with_options_secrets`
    """

    return (
        connection.connectionArguments.__root__
        if connection.connectionArguments and connection.connectionArguments.__root__
        else {}
    )


def get_connection_options_dict(connection) -> Optional[Dict[str, Any]]:
    """
    Given a connection object, returns the connection options
    dictionary if exists
    """
    return (
        connection.connectionOptions.__root__
        if connection.connectionOptions and connection.connectionOptions.__root__
        else None
    )


def init_empty_connection_arguments() -> ConnectionArguments:
    """
    Initialize a ConnectionArguments model with an empty dictionary.
    This helps set keys without further validations.

    Running `ConnectionArguments()` returns `ConnectionArguments(__root__=None)`.

    Instead, we want `ConnectionArguments(__root__={}})` so that
    we can pass new keys easily as `connectionArguments.__root__["key"] = "value"`
    """
    return ConnectionArguments(__root__={})


def init_empty_connection_options() -> ConnectionOptions:
    """
    Initialize a ConnectionOptions model with an empty dictionary.
    This helps set keys without further validations.

    Running `ConnectionOptions()` returns `ConnectionOptions(__root__=None)`.

    Instead, we want `ConnectionOptions(__root__={}})` so that
    we can pass new keys easily as `ConnectionOptions.__root__["key"] = "value"`
    """
    return ConnectionOptions(__root__={})
