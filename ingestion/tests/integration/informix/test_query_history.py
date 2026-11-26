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
"""Usage and lineage read sysmaster:syssqltrace, which only a real server fills.

Tracing is switched on for the module and the statements are run through dbaccess,
another client, as a user's workload would be.
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import text
from tenacity import retry, stop_after_delay, wait_fixed

from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection as InformixConnectionConfig,
)
from metadata.ingestion.source.database.informix.connection import InformixConnection
from metadata.ingestion.source.database.informix.lineage import InformixLineageSource
from metadata.ingestion.source.database.informix.usage import InformixUsageSource

from .conftest import (  # noqa: TID252
    DATABASE,
    INFORMIX_PORT,
    PASSWORD,
    SERVER_NAME,
    USERNAME,
    _dbaccess,
)

WRITE = "INSERT INTO trace_dst SELECT id FROM trace_src"
CROSS_DATABASE_READ = f"SELECT COUNT(*) FROM {DATABASE}:informix.trace_src"
OWN_READ = "SELECT FIRST 1 id FROM trace_dst"


@pytest.fixture(scope="module")
def engine(informix_container):
    config = InformixConnectionConfig(
        hostPort=f"localhost:{informix_container.get_exposed_port(INFORMIX_PORT)}",
        database=DATABASE,
        username=USERNAME,
        password=PASSWORD,
        serverName=SERVER_NAME,
    )
    return InformixConnection(config).client


@pytest.fixture(scope="module")
def traced(informix_container, engine):
    # The image builds sysadmin in the background, after the server first answers.
    @retry(stop=stop_after_delay(600), wait=wait_fixed(10), reraise=True)
    def _trace_every_statement():
        _dbaccess(
            informix_container,
            "sysadmin",
            'EXECUTE FUNCTION task("set sql tracing on", 2000, "4k", "medium", "global");',
        )

    _trace_every_statement()
    _dbaccess(
        informix_container,
        DATABASE,
        f"CREATE TABLE trace_src (id INT);\nCREATE TABLE trace_dst (id INT);\nINSERT INTO trace_src VALUES (1);\n"
        f"{WRITE};\n{CROSS_DATABASE_READ};",
    )
    # The connector's own statements carry the OpenMetadata query comment.
    with engine.connect() as conn:
        conn.execute(text(OWN_READ)).fetchall()
    yield
    _dbaccess(informix_container, "sysadmin", 'EXECUTE FUNCTION task("set sql tracing off");')


def history_source(source_class, engine):
    source = source_class.__new__(source_class)
    source.engine = engine
    source.source_config = SimpleNamespace(resultLimit=1000, filterCondition=None)
    now = datetime.utcnow()
    source.start, source.end = now - timedelta(days=1), now + timedelta(days=1)
    source.config = SimpleNamespace(serviceName="informix_service")
    source.dialect = SimpleNamespace(value="ansi")
    return source


@pytest.mark.usefixtures("traced")
class TestQueryHistory:
    def test_lineage_reads_writes_with_their_database(self, engine):
        queries = {
            (query.query, query.databaseName)
            for query in history_source(InformixLineageSource, engine).yield_table_query()
        }
        assert (WRITE, DATABASE) in queries

    def test_usage_reads_statements_with_utc_times(self, engine):
        usage = {
            query.query: query
            for batch in history_source(InformixUsageSource, engine).yield_table_queries()
            for query in batch.queries
        }
        read = usage[f"SELECT COUNT(*) FROM {DATABASE}.informix.trace_src"]
        assert read.databaseName == DATABASE
        # sql_begintxtime is a tick counter; reading it as a time lands in 1970.
        assert abs(datetime.fromisoformat(read.startTime) - datetime.utcnow()) < timedelta(hours=1)

    def test_the_connectors_own_statements_are_left_out(self, engine):
        queries = [
            query.query
            for batch in history_source(InformixUsageSource, engine).yield_table_queries()
            for query in batch.queries
        ]
        assert not [query for query in queries if "trace_dst" in query and query.startswith("SELECT")]
