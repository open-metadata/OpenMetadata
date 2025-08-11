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
Connection secrets utils
"""
from functools import wraps

from metadata.ingestion.models.custom_pydantic import CustomSecretStr


# Annotated CustomSecretStr does not like the get_secret_value()
# pylint: disable=no-member
def update_connection_opts_args(connection):
    if (
        hasattr(connection, "connectionOptions")
        and connection.connectionOptions
        and connection.connectionOptions.root
    ):
        for key, value in connection.connectionOptions.root.items():
            if isinstance(value, str):
                connection.connectionOptions.root[key] = CustomSecretStr(
                    value
                ).get_secret_value()
    if (
        hasattr(connection, "connectionArguments")
        and connection.connectionArguments
        and connection.connectionArguments.root
    ):
        for key, value in connection.connectionArguments.root.items():
            if isinstance(value, str):
                connection.connectionArguments.root[key] = CustomSecretStr(
                    value
                ).get_secret_value()


def connection_with_options_secrets(fn):
    """Decorator used for get any secret from the Secrets Manager that has been passed inside connection options
    or arguments.
    """

    @wraps(fn)
    def inner(connection, **kwargs):
        update_connection_opts_args(connection)
        return fn(connection, **kwargs)

    return inner
