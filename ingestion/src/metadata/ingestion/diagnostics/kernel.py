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
Diagnostics runtime kernel — the handler singleton and the log emitter.

Dependency-free leaf module so every other diagnostics module can top-import
from it.
"""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

from metadata.utils.logger import diag_logger

if TYPE_CHECKING:
    from metadata.ingestion.diagnostics.handler import DiagnosticsHandler


_handler: DiagnosticsHandler | None = None


def get_handler() -> DiagnosticsHandler | None:
    """The installed DiagnosticsHandler, or None when diagnostics is off."""
    return _handler


def set_handler(handler: DiagnosticsHandler | None) -> None:
    """Install or clear the singleton. Only ``install()`` / ``shutdown()`` should call this."""
    global _handler  # noqa: PLW0603
    _handler = handler


def emit_log(level: int, message: str) -> None:
    """Emit a diagnostics line, falling back to stderr if the logger errors.

    Not signal-safe — use ``sys.stderr.write`` directly from signal context.
    """
    try:
        diag_logger().log(level, message)
    except Exception:
        try:
            sys.stderr.write(message.rstrip("\n") + "\n")
            sys.stderr.flush()
        except Exception:
            pass
