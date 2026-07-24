#!/usr/bin/env python3

#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Generate the Playwright TLS HTTP/2 config from the current server config."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence


SERVER_MARKER = "server:\n"
APPLICATION_CONNECTORS_MARKER = "  applicationConnectors:\n"
ADMIN_CONNECTORS_MARKER = "  adminConnectors:\n"

H2_APPLICATION_CONNECTOR = """  applicationConnectors:
    - type: h2
      bindHost: ${SERVER_HOST:-0.0.0.0}
      port: ${SERVER_PORT:-8585}
      keyStorePath: ${SERVER_H2_KEYSTORE_PATH}
      keyStorePassword: ${SERVER_H2_KEYSTORE_PASSWORD:-openmetadata}
      keyStoreType: PKCS12
      certAlias: openmetadata-h2
      supportedProtocols: [TLSv1.2, TLSv1.3]
      supportedCipherSuites:
        - TLS_AES_256_GCM_SHA384
        - TLS_AES_128_GCM_SHA256
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
        - TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
      maxConcurrentStreams: 1024
      initialStreamRecvWindow: 65535
      uriCompliance: UNSAFE
      acceptorThreads: ${SERVER_ACCEPTOR_THREADS:-2}
      selectorThreads: ${SERVER_SELECTOR_THREADS:-8}
      acceptQueueSize: ${SERVER_ACCEPT_QUEUE_SIZE:-256}
      idleTimeout: ${SERVER_IDLE_TIMEOUT:-60 seconds}
      outputBufferSize: ${SERVER_OUTPUT_BUFFER_SIZE:-32KiB}
      inputBufferSize: ${SERVER_INPUT_BUFFER_SIZE:-8KiB}
      maxRequestHeaderSize: ${SERVER_MAX_REQUEST_HEADER_SIZE:-8KiB}
      maxResponseHeaderSize: ${SERVER_MAX_RESPONSE_HEADER_SIZE:-8KiB}
      headerCacheSize: ${SERVER_HEADER_CACHE_SIZE:-512B}
      useServerHeader: false
      useDateHeader: true
      useForwardedHeaders: ${SERVER_USE_FORWARDED_HEADERS:-false}
      minRequestDataPerSecond: ${SERVER_MIN_REQUEST_DATA_RATE:-0B}
      minResponseDataPerSecond: ${SERVER_MIN_RESPONSE_DATA_RATE:-0B}

"""


def _unique_line_index(lines: list[str], marker: str, description: str) -> int:
    indexes = [index for index, line in enumerate(lines) if line == marker]
    if len(indexes) != 1:
        raise ValueError(
            f"Expected exactly one {description} marker {marker.rstrip()!r}, "
            f"found {len(indexes)}"
        )
    return indexes[0]


def render_h2_config(source: str) -> str:
    lines = source.splitlines(keepends=True)
    server_index = _unique_line_index(lines, SERVER_MARKER, "top-level server")
    application_index = _unique_line_index(
        lines,
        APPLICATION_CONNECTORS_MARKER,
        "server.applicationConnectors",
    )
    admin_index = _unique_line_index(
        lines,
        ADMIN_CONNECTORS_MARKER,
        "server.adminConnectors",
    )

    if not server_index < application_index < admin_index:
        raise ValueError(
            "Expected server.applicationConnectors before server.adminConnectors "
            "inside the top-level server block"
        )

    return (
        "".join(lines[:application_index])
        + H2_APPLICATION_CONNECTOR
        + "".join(lines[admin_index:])
    )


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.source.resolve() == args.output.resolve():
        raise ValueError("Source and output paths must be different")

    rendered = render_h2_config(args.source.read_text())
    args.output.write_text(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
