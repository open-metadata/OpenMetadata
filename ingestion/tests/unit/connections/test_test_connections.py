from contextlib import contextmanager
from unittest.mock import Mock

import pytest
import sqlalchemy
from sqlalchemy import create_engine

from metadata.ingestion.connections.test_connections import test_connection_engine_step


def assert_execute(engine, expected_query):
    def inner(query, *_, **__):
        assert str(query.compile(dialect=engine.dialect)) == expected_query

    return inner


def create_mock_connect(mock):

    @contextmanager
    def mock_connect(*_, **__):
        yield mock

    return mock_connect


@pytest.fixture(autouse=True, scope="function")
def bigquery(monkeypatch):
    monkeypatch.setattr(
        "google.cloud.bigquery.Client",
        Mock(),
    )
    monkeypatch.setattr(
        "google.cloud.bigquery.Client.from_service_account_json",
        Mock(),
    )


@pytest.mark.parametrize(
    "dialect,expected_test_fn",
    (
        [
            ("sqlite", "SELECT 42"),
            ("mysql", "SELECT 42"),
            ("bigquery", "SELECT SESSION_USER()"),
            ("ibmi", "SELECT SESSION_USER()"),
        ]
    ),
)
def test_test_connection_engine_step(dialect, expected_test_fn, monkeypatch):
    # TODO this is skipped noqw because installing ibm_db_sa requires going through hoops
    if dialect == "ibmi":
        return
    engine = create_engine(dialect + "://")
    mock_connect = Mock()
    mock_connect.execute = assert_execute(engine, expected_test_fn)
    if dialect != "sqlite":
        engine.connect = create_mock_connect(mock_connect)
    test_connection_engine_step(engine)
