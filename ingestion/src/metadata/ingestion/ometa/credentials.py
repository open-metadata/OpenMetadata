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

import os
from typing import Tuple

import dateutil.parser

Credentials = Tuple[str, str, str]


class URL(str):
    def __new__(cls, *value):
        """
        note: we use *value and v0 to allow an empty URL string
        """
        if value:
            v0 = value[0]
            if not (isinstance(v0, str) or isinstance(v0, URL)):
                raise TypeError(f'Unexpected type for URL: "{type(v0)}"')
            if not (
                v0.startswith("http://")
                or v0.startswith("https://")
                or v0.startswith("ws://")
                or v0.startswith("wss://")
            ):
                raise ValueError(
                    f'Passed string value "{v0}" is not an'
                    f' "http*://" or "ws*://" URL'
                )
        return str.__new__(cls, *value)


class DATE(str):
    """
    date string in the format YYYY-MM-DD
    """

    def __new__(cls, value):
        if not value:
            raise ValueError("Unexpected empty string")
        if not isinstance(value, str):
            raise TypeError(f'Unexpected type for DATE: "{type(value)}"')
        if value.count("-") != 2:
            raise ValueError(
                f"Unexpected date structure. expected " f'"YYYY-MM-DD" got {value}'
            )
        try:
            dateutil.parser.parse(value)
        except Exception as e:
            msg = f"{value} is not a valid date string: {e}"
            raise Exception(msg)
        return str.__new__(cls, value)


class FLOAT(str):
    """
    api allows passing floats or float as strings.
    let's make sure that param passed is one of the two, so we don't pass
    invalid strings all the way to the servers.
    """

    def __new__(cls, value):
        if isinstance(value, float) or isinstance(value, int):
            return value
        if isinstance(value, str):
            return float(value.strip())
        raise ValueError(f'Unexpected float format "{value}"')


def get_credentials(
    key_id: str = None, secret_key: str = None, oauth: str = None
) -> Credentials:
    oauth = oauth or os.environ.get("OMETA_API_OAUTH_TOKEN")

    key_id = key_id or os.environ.get("OMETA_API_KEY_ID")
    if key_id is None and oauth is None:
        raise ValueError(
            "Key ID must be given to access Alpaca trade API",
            " (env: OMETA_API_KEY_ID)",
        )

    secret_key = secret_key or os.environ.get("OMETA_API_SECRET_KEY")
    if secret_key is None and oauth is None:
        raise ValueError(
            "Secret key must be given to access Alpaca trade API"
            " (env: OMETA_API_SECRET_KEY"
        )

    return key_id, secret_key, oauth


def get_api_version(api_version: str) -> str:
    api_version = api_version or os.environ.get("APCA_API_VERSION")
    if api_version is None:
        api_version = "v1"

    return api_version
