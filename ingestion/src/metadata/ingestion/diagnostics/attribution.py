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
Operation identity / attribution.

Answers "what is this op, for hotspot and slow-op reporting?" — shared by the
time sampler and the slow-op recorder so both attribute identically:

  * HTTP funnels every call through one client method, so the stack frame is
    useless — key by the **endpoint** (method + path template, ids collapsed).
  * everything else keys by the deepest **project stack frame**, which is the
    OM method that issued the work (a query blocked in the driver attributes to
    `get_columns`, not the socket read).

Kept separate from the registry's state-management so the registry stays a
thread-safe op-stack and this stays the (stateless) naming logic.
"""

from types import FrameType
from typing import Any
from urllib.parse import urlsplit

from metadata.ingestion.diagnostics.formatting import short_path

HTTP_OP = "ometa.http"

_DIAGNOSTICS_PACKAGE = "/diagnostics/"
_PROJECT_MARKER = "/metadata/"
_ID_PLACEHOLDER = ":id"
_FQN_PLACEHOLDER = ":fqn"
_NAME_SEGMENT = "name"
_UUID_PART_LENGTHS = (8, 4, 4, 4, 12)
_HEX_DIGITS = "0123456789abcdefABCDEF"


def op_identity(op_name: str, kwargs: dict[str, Any], frame: FrameType | None) -> str:
    """Identity of an op for slow-op / hotspot attribution.

    HTTP keys by endpoint (the stack frame is one shared client method);
    everything else keys by the deepest project frame that issued the work.
    """
    if op_name == HTTP_OP:
        return _http_key(kwargs)
    return _frame_method(frame)


def _frame_method(frame: FrameType | None) -> str:
    """Key for the deepest project (`metadata/`) frame on the stack.

    Walking from the leaf upward, return the first frame inside the project
    package — when a thread is blocked in a library call (socket/ssl/driver),
    that's the OM method that issued it. Falls back to the deepest
    non-diagnostics frame if the stack has no project frame at all.
    """
    fallback: FrameType | None = None
    current = frame
    result = ""
    while current is not None:
        filename = current.f_code.co_filename
        if _DIAGNOSTICS_PACKAGE not in filename:
            if fallback is None:
                fallback = current
            if _PROJECT_MARKER in filename:
                break
        current = current.f_back
    target = current if current is not None else fallback
    if target is not None:
        result = _frame_key(target)
    return result


def _frame_key(frame: FrameType) -> str:
    code = frame.f_code
    qualname = getattr(code, "co_qualname", code.co_name)
    return f"{short_path(code.co_filename)}:{qualname}"


def _http_key(kwargs: dict[str, Any]) -> str:
    """Endpoint key for an `ometa.http` op: method + path template.

    Collapses the identifying segments so all calls to the same endpoint
    aggregate: numeric/UUID ids -> `:id`, and the segment after `name`
    (entity-by-FQN lookups) -> `:fqn`.
    """
    method = str(kwargs.get("method", "")).upper()
    segments = urlsplit(str(kwargs.get("url", ""))).path.split("/")
    template = "/".join(_template_segment(segments, index) for index in range(len(segments)))
    return f"{method} {template}".strip() or HTTP_OP


def _template_segment(segments: list[str], index: int) -> str:
    if index > 0 and segments[index - 1] == _NAME_SEGMENT:
        return _FQN_PLACEHOLDER
    if _is_id_segment(segments[index]):
        return _ID_PLACEHOLDER
    return segments[index]


def _is_id_segment(segment: str) -> bool:
    return segment.isdigit() or _is_uuid(segment)


def _is_uuid(segment: str) -> bool:
    parts = segment.split("-")
    return len(parts) == len(_UUID_PART_LENGTHS) and all(
        len(part) == length and all(char in _HEX_DIGITS for char in part)
        for part, length in zip(parts, _UUID_PART_LENGTHS, strict=False)
    )
