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
Shared human-readable formatters for diagnostics output.

One home for the byte / duration / share-bar / path-shortening helpers so the
collectors, monitors and reporters render consistently and don't each grow
their own (drifting) copies. These run at render time (end-of-run, heartbeat,
dump) — never on a hot path — so clarity is the priority here.
"""

BYTES_PER_KIB = 1024
BYTES_PER_MIB = BYTES_PER_KIB * 1024
BYTES_PER_GIB = BYTES_PER_MIB * 1024

MILLIS_PER_SECOND = 1000
SECONDS_PER_MINUTE = 60
SECONDS_PER_HOUR = 3600

FULL_PERCENT = 100.0
DEFAULT_BAR_WIDTH = 10

_UNKNOWN = "?"


def format_bytes(n: int | None) -> str:
    if n is None:
        return _UNKNOWN
    magnitude = abs(n)
    if magnitude >= BYTES_PER_GIB:
        return f"{n / BYTES_PER_GIB:.1f}G"
    if magnitude >= BYTES_PER_MIB:
        return f"{n / BYTES_PER_MIB:.0f}M"
    if magnitude >= BYTES_PER_KIB:
        return f"{n / BYTES_PER_KIB:.0f}K"
    return f"{n}B"


def format_signed_bytes(n: int | None) -> str:
    if n is None:
        return _UNKNOWN
    sign = "+" if n >= 0 else "-"
    return sign + format_bytes(abs(n))


def fmt_age(seconds: float | None) -> str:
    """Human-readable duration: `500ms` / `4.1s` / `2m05s` / `1h03m`."""
    if seconds is None:
        return _UNKNOWN
    if seconds < 1:
        return f"{int(seconds * MILLIS_PER_SECOND)}ms"
    if seconds < SECONDS_PER_MINUTE:
        return f"{seconds:.1f}s"
    if seconds < SECONDS_PER_HOUR:
        minutes, secs = divmod(int(seconds), SECONDS_PER_MINUTE)
        return f"{minutes}m{secs:02d}s"
    hours, remainder = divmod(int(seconds), SECONDS_PER_HOUR)
    minutes, _ = divmod(remainder, SECONDS_PER_MINUTE)
    return f"{hours}h{minutes:02d}m"


def share_bar(pct: float, width: int = DEFAULT_BAR_WIDTH) -> str:
    filled = round(min(pct, FULL_PERCENT) / FULL_PERCENT * width)
    return "[" + "█" * filled + " " * (width - filled) + "]"


def short_method(name: str) -> str:
    """Shorten a frame key `path/to/file.py:Qual.method` to `file.py:Qual.method`.

    Endpoint keys (no `.py:`) and `(other)` are returned unchanged.
    """
    if ".py:" in name:
        path, qualname = name.split(".py:", 1)
        return f"{path.rsplit('/', 1)[-1]}.py:{qualname}"
    return name


def short_path(path: str) -> str:
    for marker in ("/site-packages/", "/src/"):
        index = path.rfind(marker)
        if index != -1:
            return path[index + len(marker) :]
    return path.rsplit("/", 1)[-1]
