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
"""Reading must not lock the table, and must not be able to write to it.

Nothing here commits, because the connector only reads. On an ANSI-mode database
that combination is what holds a lock on everything read until the connection
closes -- for a profiler run, the whole run. Committed Read removes it.

Autocommit removes it too, and is the obvious fix, which is why the second test
exists: under autocommit a write that reached the server would be committed
rather than rolled back when the connection returns to the pool.
"""

import pytest
from sqlalchemy import create_engine, text

from metadata.ingestion.source.database.informix.connection import _use_committed_read

from .conftest import (  # noqa: TID252
    ANSI_DATABASE,
    INFORMIX_PORT,
    PASSWORD,
    SERVER_NAME,
    USERNAME,
)


def _locks_on(container, database: str) -> int:
    _, output = container.get_wrapped_container().exec_run(
        ["bash", "-lc", f"onstat -k | grep -c '{database}:' || true"]
    )
    return int(output.decode(errors="replace").strip() or 0)


@pytest.fixture
def ansi_engine(informix_container):
    """An engine on the ANSI database, wired exactly as the connector wires one."""
    port = informix_container.get_exposed_port(INFORMIX_PORT)
    engine = create_engine(
        f"informix://{USERNAME}:{PASSWORD}@localhost:{port}/{ANSI_DATABASE}?INFORMIXSERVER={SERVER_NAME}&DELIMIDENT=y"
    )
    _use_committed_read(engine)
    yield engine
    engine.dispose()


def test_an_open_read_holds_no_lock(ansi_engine, informix_container):
    with ansi_engine.connect() as conn:
        conn.execute(text("SELECT id FROM ledger")).fetchall()
        assert _locks_on(informix_container, ANSI_DATABASE) == 0


def test_an_uncommitted_write_is_still_rolled_back(ansi_engine):
    """The safety net autocommit would have removed.

    The connector issues no writes, so this guards the transaction semantics
    rather than any code path we have today.
    """
    with ansi_engine.connect() as conn:
        conn.execute(text("INSERT INTO ledger VALUES (99)"))

    with ansi_engine.connect() as conn:
        assert conn.execute(text("SELECT COUNT(*) FROM ledger WHERE id = 99")).scalar() == 0
