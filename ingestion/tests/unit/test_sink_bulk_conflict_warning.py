#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");

"""
Unit tests for the dedicated query bulk path in the metadata-rest sink classifying an
already-present query (duplicate checksum / nameHash unique-constraint violation) as a
warning instead of a failure, so a lineage run is not marked failed over a query that lost
no metadata.
"""

from unittest.mock import Mock

import pytest

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.generated.schema.type.bulkOperationResult import (
    BulkOperationResult,
    Response,
)
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
    is_duplicate_query_conflict,
)

CHECKSUM_CONFLICT = (
    'org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "unique_query_checksum"'
)
NAMEHASH_CONFLICT_PG = 'duplicate key value violates unique constraint "query_entity_namehash_key"'
NAMEHASH_CONFLICT_MYSQL = "Duplicate entry 'abc' for key 'query_entity.nameHash'"
REAL_ERROR = "Invalid entity: SqlQuery must not be null"


@pytest.fixture
def sink():
    config = MetadataRestSinkConfig(bulk_sink_batch_size=10)
    return MetadataRestSink(config, Mock())


def _result(failed_messages):
    return BulkOperationResult(
        status=basic.Status.partialSuccess,
        numberOfRowsProcessed=len(failed_messages),
        numberOfRowsPassed=0,
        numberOfRowsFailed=len(failed_messages),
        successRequest=[],
        failedRequest=[Response(request=f"svc.{i}", message=msg, status=400) for i, msg in enumerate(failed_messages)],
    )


def _flush_queries(sink, result):
    sink.metadata.bulk_create_or_update.return_value = result
    sink.query_buffer = [CreateQueryRequest(query=SqlQuery("SELECT 1"), service=FullyQualifiedEntityName("svc"))]
    return sink._flush_query_buffer()


def test_already_present_queries_become_warnings_not_failures(sink):
    out = _flush_queries(sink, _result([CHECKSUM_CONFLICT, NAMEHASH_CONFLICT_PG, NAMEHASH_CONFLICT_MYSQL]))

    assert len(sink.status.warnings) == 3
    assert len(sink.status.failures) == 0
    assert out.left is None


def test_real_failures_are_still_recorded(sink):
    out = _flush_queries(sink, _result([CHECKSUM_CONFLICT, REAL_ERROR]))

    assert len(sink.status.warnings) == 1
    assert len(sink.status.failures) == 1
    assert REAL_ERROR in sink.status.failures[0].error
    assert out.left is not None


def test_is_duplicate_query_conflict_classification():
    assert is_duplicate_query_conflict(CHECKSUM_CONFLICT) is True
    assert is_duplicate_query_conflict(NAMEHASH_CONFLICT_PG) is True
    assert is_duplicate_query_conflict(NAMEHASH_CONFLICT_MYSQL) is True
    assert is_duplicate_query_conflict(REAL_ERROR) is False
    assert is_duplicate_query_conflict(None) is False
    assert is_duplicate_query_conflict("") is False


def _query(text="SELECT 1"):
    return CreateQueryRequest(query=SqlQuery(text), service=FullyQualifiedEntityName("svc"))


def test_dispatch_routes_query_to_dedicated_buffer(sink):
    sink._run(_query())

    assert len(sink.query_buffer) == 1
    assert len(sink.buffer) == 0


def test_close_flushes_pending_query_buffer(sink):
    sink.metadata.bulk_create_or_update.return_value = _result([])
    sink._run(_query())
    assert len(sink.query_buffer) == 1

    sink.close()

    sink.metadata.bulk_create_or_update.assert_called_once()
    assert len(sink.query_buffer) == 0


def test_barrier_flushes_pending_query_buffer(sink):
    sink.metadata.bulk_create_or_update.return_value = _result([])
    sink._run(_query())

    sink.write_barrier(Barrier(reason="test"))

    sink.metadata.bulk_create_or_update.assert_called_once()
    assert len(sink.query_buffer) == 0


def test_barrier_surfaces_genuine_query_failure(sink):
    sink.metadata.bulk_create_or_update.return_value = _result([REAL_ERROR])
    sink._run(_query())

    out = sink.write_barrier(Barrier(reason="test"))

    assert out.left is not None
    assert len(sink.status.failures) == 1


def test_all_benign_conflicts_keep_run_green(sink):
    sink.metadata.bulk_create_or_update.return_value = _result([CHECKSUM_CONFLICT])
    sink._run(_query())

    out = sink.write_barrier(Barrier(reason="test"))

    assert out.left is None
    assert len(sink.status.failures) == 0
    assert len(sink.status.warnings) == 1
