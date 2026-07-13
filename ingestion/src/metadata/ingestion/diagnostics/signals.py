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
Signal-handler wiring for on-demand dumps.

Maps SIGUSR1 → full dump and SIGUSR2 → incremental dump, both delegated to the
handler. Handlers run in signal context, so they ask for `signal_safe=True`
(synchronous stderr write — the logger's per-handler RLocks are not signal-safe).
`faulthandler.enable` is a free belt-and-braces for fatal aborts. Best-effort:
skips gracefully on Windows (no SIGUSR1) or off the main thread.
"""

import faulthandler
import logging
import signal
import sys
import threading
from typing import Any

from metadata.ingestion.diagnostics.config import DIAG_LOG_PREFIX
from metadata.ingestion.diagnostics.kernel import emit_log


def install_signal_handlers(handler: Any) -> bool:
    """Wire SIGUSR1 / SIGUSR2 / faulthandler to the handler's dump methods.

    Returns True if anything was installed. On Windows (no SIGUSR1) or when
    called off the main thread, falls back gracefully without raising.
    """
    if threading.current_thread() is not threading.main_thread():
        # Python's signal handlers can only be installed from the main thread;
        # skip and let the watchdog/heartbeat do the work.
        emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.signals skipped reason=not-main-thread")
        return False

    installed_any = False
    try:
        faulthandler.enable(file=sys.stderr)
        installed_any = True
    except Exception as exc:
        emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.faulthandler failed err={exc!r}")

    sigusr1 = getattr(signal, "SIGUSR1", None)
    sigusr2 = getattr(signal, "SIGUSR2", None)

    if sigusr1 is not None:
        try:
            signal.signal(sigusr1, _dump_handler(handler, reason="sigusr1", incremental=False))
            installed_any = True
        except (OSError, ValueError) as exc:
            emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.sigusr1 failed err={exc!r}")

    if sigusr2 is not None:
        try:
            signal.signal(sigusr2, _dump_handler(handler, reason="sigusr2", incremental=True))
            installed_any = True
        except (OSError, ValueError) as exc:
            emit_log(logging.WARNING, f"{DIAG_LOG_PREFIX}.install.sigusr2 failed err={exc!r}")

    return installed_any


def _dump_handler(handler: Any, reason: str, incremental: bool) -> Any:
    def _handler(_signum: int, _frame: Any) -> None:
        # Signal context — must NOT use the logger (per-handler RLocks are not
        # signal-safe). The handler's dump writes straight to stderr.
        try:
            if incremental:
                handler.emit_incremental_dump(signal_safe=True)
            else:
                handler.emit_dump(reason=reason, signal_safe=True)
        except Exception as exc:
            sys.stderr.write(f"{DIAG_LOG_PREFIX}.dump.error reason={reason} err={exc!r}\n")
            sys.stderr.flush()

    return _handler
