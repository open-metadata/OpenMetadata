#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");

"""
Unit tests for the metadata-rest sink classifying benign bulk-flush conflicts (duplicate-key /
within-batch duplicate) as warnings instead of failures, so a lineage run does not go red over
conflicts that lost no metadata.
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
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
)

DUPLICATE_KEY = (
    'org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "unique_query_checksum"'
)
ENTITY_NOT_CREATED = "Entity does not exist and could not be created"
REAL_ERROR = "Invalid entity: name must not be null"


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


def _flush(sink, result):
    sink.metadata.bulk_create_or_update.return_value = result
    sink.buffer = [CreateQueryRequest(query=SqlQuery("SELECT 1"), service=FullyQualifiedEntityName("svc"))]
    return sink._flush_buffer()


def test_benign_conflicts_become_warnings_not_failures(sink):
    out = _flush(sink, _result([DUPLICATE_KEY, ENTITY_NOT_CREATED]))

    assert len(sink.status.warnings) == 2
    assert len(sink.status.failures) == 0
    # No genuine failure -> the flush is reported as a success (status stays green).
    assert out.left is None


def test_real_failures_are_still_recorded(sink):
    out = _flush(sink, _result([DUPLICATE_KEY, REAL_ERROR]))

    assert len(sink.status.warnings) == 1
    assert len(sink.status.failures) == 1
    assert REAL_ERROR in sink.status.failures[0].error
    # A genuine failure is present -> the flush is reported as failed.
    assert out.left is not None


def test_is_benign_bulk_failure_classification(sink):
    assert sink._is_benign_bulk_failure(DUPLICATE_KEY) is True
    assert sink._is_benign_bulk_failure("Duplicate entry '...' for key 'unique_query_checksum'") is True
    assert sink._is_benign_bulk_failure(ENTITY_NOT_CREATED) is True
    assert sink._is_benign_bulk_failure(REAL_ERROR) is False
    assert sink._is_benign_bulk_failure(None) is False
    assert sink._is_benign_bulk_failure("") is False
