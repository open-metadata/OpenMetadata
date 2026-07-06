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
"""MySQL declares the single-database ``Database`` denominator and defers the
``DatabaseSchema`` total to runner reconciliation."""

from types import SimpleNamespace

import pytest

from metadata.ingestion.progress.modes import TotalsDeclarer
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.ingestion.source.database.mysql.metadata import MysqlSource


def _source(service_connection):
    source = object.__new__(MysqlSource)
    source.service_connection = service_connection
    source.__dict__["_progress_registry"] = ProgressRegistry()
    return source


@pytest.fixture
def mysql_source():
    return _source(SimpleNamespace(databaseName=None, database="mydb"))


def test_declare_progress_totals_seeds_single_database(mysql_source):
    mysql_source.declare_progress_totals(TotalsDeclarer(mysql_source.progress))
    counters = {t: (done, total) for t, done, total in mysql_source.progress.global_counters()}
    assert counters["Database"] == (0, 1)


def test_declare_progress_totals_marks_schema_reconcilable(mysql_source):
    mysql_source.declare_progress_totals(TotalsDeclarer(mysql_source.progress))
    assert mysql_source.progress.is_reconcilable("DatabaseSchema") is True
    counters = {t: (done, total) for t, done, total in mysql_source.progress.global_counters()}
    assert counters["DatabaseSchema"] == (0, None)


def test_declare_progress_totals_defaults_database_name_when_unset(mysql_source):
    source = _source(SimpleNamespace(databaseName=None, database=None))
    source.declare_progress_totals(TotalsDeclarer(source.progress))
    counters = {t: (done, total) for t, done, total in source.progress.global_counters()}
    assert counters["Database"] == (0, 1)
