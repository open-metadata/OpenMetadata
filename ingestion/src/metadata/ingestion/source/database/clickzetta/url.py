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

from collections.abc import Mapping
from typing import Optional

from sqlalchemy.engine import URL

_RESERVED_CONNECTION_OPTIONS = frozenset(
    {
        "virtualcluster",
        "schema",
        "protocol",
    }
)


def _split_host_port(
    host_port: str,
) -> tuple[str, Optional[int]]:  # noqa: UP045
    if ":" not in host_port:
        return host_port, None
    host, port_text = host_port.rsplit(":", 1)
    if not host or not port_text.isdigit():
        raise ValueError(f"Invalid ClickZetta hostPort: {host_port!r}")
    return host, int(port_text)


def build_clickzetta_url(
    *,
    host_port: str,
    username: str,
    password: str,
    workspace: str,
    virtual_cluster: str,
    database_schema: Optional[str],  # noqa: UP045
    protocol: str,
    connection_options: Optional[Mapping[str, str]] = None,  # noqa: UP045
) -> URL:
    host, port = _split_host_port(host_port)
    option_keys = {key.casefold() for key in (connection_options or {})}
    reserved_collisions = sorted(option_keys & _RESERVED_CONNECTION_OPTIONS)
    if reserved_collisions:
        raise ValueError(
            f"ClickZetta connectionOptions cannot override reserved URL keys: {', '.join(reserved_collisions)}"
        )

    query = {key: value for key, value in (connection_options or {}).items() if value}
    query["virtualcluster"] = virtual_cluster
    if database_schema:
        query["schema"] = database_schema
    if protocol == "http":
        query["protocol"] = "http"
    return URL.create(
        drivername="clickzetta",
        username=username,
        password=password,
        host=host,
        port=port,
        database=workspace,
        query=query,
    )
