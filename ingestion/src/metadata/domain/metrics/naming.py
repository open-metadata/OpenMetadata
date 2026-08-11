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
"""Connector-agnostic Metric name qualification.

Metric FQN == name (flat namespace, server splits on ``.``). Callers pass the
full identifying tuple (e.g. ``service, database, schema, view, metric`` for
Snowflake, ``service, project, metric`` for dbt); this module joins them into a
single, dot-free FQN segment safe for the server and stable across runs.
"""

from __future__ import annotations

import hashlib

from metadata.utils import fqn as fqn_utils

_NAME_SEPARATOR = "-"
_DEFAULT_MAX_LENGTH = 256
_DIGEST_LENGTH = 12
_RESERVED_CHARS = (".", ":", ">")


def build_qualified_metric_name(*parts: str, max_length: int = _DEFAULT_MAX_LENGTH) -> str:
    """Return a globally-unique metric name as a single FQN segment.

    Sanitizes each part (unquote, then strip characters that carry FQN meaning),
    joins with ``-``, and — if the result exceeds ``max_length`` — truncates and
    appends a deterministic sha256 tail so distinct long inputs never collide
    on truncation.
    """
    cleaned = [_sanitize(part) for part in parts]
    joined = _NAME_SEPARATOR.join(cleaned)
    if len(joined) <= max_length:
        return joined
    digest = hashlib.sha256(joined.encode("utf-8")).hexdigest()[:_DIGEST_LENGTH]
    keep = max_length - _DIGEST_LENGTH - len(_NAME_SEPARATOR)
    return f"{joined[:keep]}{_NAME_SEPARATOR}{digest}"


def _sanitize(part: str) -> str:
    cleaned = fqn_utils.unquote_name(part or "").replace('"', "")
    for reserved in _RESERVED_CHARS:
        cleaned = cleaned.replace(reserved, "_")
    return cleaned
