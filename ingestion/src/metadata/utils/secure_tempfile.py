#  Copyright 2026 Collate
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
Temporary files for secret material.

Some clients cannot take a credential as a string — Java's ``CertificateFactory``
wants a path, ``ssl.SSLContext.load_cert_chain`` wants a path, the Google auth
library reads ``GOOGLE_APPLICATION_CREDENTIALS`` from disk. Those callers have to
materialise the secret, and every one of them used to hand-roll it.

Prefer :func:`secret_temp_file` — it removes the file on the way out whether the
body succeeded or raised. Only reach for :func:`write_secret_temp_file` when the
file must outlive the calling scope (a connection's lifetime, a process-wide
environment variable), and pair it with :func:`remove_secret_temp_file`.

Nothing here ever logs the content — only paths.
"""

import contextlib
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from metadata.utils.logger import utils_logger

logger = utils_logger()

# Owner read/write only. `mkstemp` already creates the file this way, but the
# mode is set explicitly so the invariant survives a refactor: switching to
# `Path.write_text` — the obvious "simplification" — creates with 0666 & ~umask,
# which is world-readable on a default umask.
_SECRET_FILE_MODE = 0o600

_DEFAULT_PREFIX = "om-secret-"


def write_secret_temp_file(
    content: str | bytes,
    suffix: str = "",
    prefix: str = _DEFAULT_PREFIX,
) -> Path:
    """
    Write secret material to a new owner-only temporary file and return its path.

    The caller owns the file from here on and must delete it with
    :func:`remove_secret_temp_file`. If the write itself fails, the partial file
    is removed before the error propagates, so a half-written secret is never
    left behind.
    """
    payload = content.encode() if isinstance(content, str) else content
    file_descriptor, raw_path = tempfile.mkstemp(suffix=suffix, prefix=prefix)
    path = Path(raw_path)

    # Hand the descriptor to a file object before anything else can fail, so the
    # `with` below owns closing it. Only `fdopen` itself can leave the raw
    # descriptor unowned, and that branch closes it explicitly — closing it
    # anywhere else risks a double close, which would shut an unrelated file
    # that had since been given the same number.
    try:
        handle = os.fdopen(file_descriptor, "wb")
    except Exception:
        # Suppressed: if `fdopen` closed the descriptor before failing, the
        # close below is a no-op and cleanup must still run.
        with contextlib.suppress(OSError):
            os.close(file_descriptor)
        remove_secret_temp_file(path)
        raise

    try:
        with handle:
            # fchmod on the descriptor rather than chmod on the path: no window
            # in which the name exists with different permissions.
            os.fchmod(handle.fileno(), _SECRET_FILE_MODE)
            handle.write(payload)
    except Exception:
        remove_secret_temp_file(path)
        raise

    return path


def remove_secret_temp_file(path: str | Path) -> bool:
    """
    Delete a secret temporary file. Returns whether it is gone.

    A file that was already removed counts as success. A failure is logged and
    reported rather than raised: cleanup runs in ``finally`` blocks and on
    connection teardown, where masking the original error would be worse.
    """
    try:
        Path(path).unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Could not remove temporary credential file %s: %s", path, exc)

        return False

    return True


@contextmanager
def secret_temp_file(
    content: str | bytes,
    suffix: str = "",
    prefix: str = _DEFAULT_PREFIX,
) -> Iterator[Path]:
    """
    Materialise secret material for the duration of the ``with`` block.

    The file is removed on the way out whether the body returned or raised.
    """
    path = write_secret_temp_file(content, suffix=suffix, prefix=prefix)
    try:
        yield path
    finally:
        remove_secret_temp_file(path)
