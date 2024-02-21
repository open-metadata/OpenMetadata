from contextlib import contextmanager
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine

from metadata.ingestion.connections.test_connections import (
    test_connection_engine_step as fn_test_connection_engine_step,  # renamed to avoid getting picked up as test by pytest
)


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
        "sqlalchemy_bigquery._helpers.create_bigquery_client",
        Mock(),
    )


@pytest.mark.parametrize(
    "dialect,expected_test_fn",
    (
        [
            ("sqlite", "SELECT 42"),
            ("mysql", "SELECT 42"),
            ("bigquery", "SELECT SESSION_USER()"),
            # TODO this is skipped because installing ibm_db_sa requires going through hoops
            # ("ibmi", "SELECT 42 FROM SYSIBM.SYSDUMMY1;"),
        ]
    ),
)
def test_test_connection_engine_step(dialect, expected_test_fn):
    engine = create_engine(dialect + "://")
    mock_connect = Mock()
    mock_connect.execute = assert_execute(engine, expected_test_fn)
    if dialect != "sqlite":
        engine.connect = create_mock_connect(mock_connect)
    fn_test_connection_engine_step(engine)
