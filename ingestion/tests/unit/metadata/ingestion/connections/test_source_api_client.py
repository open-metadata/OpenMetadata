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
Tests for source API path normalization used by TrackedREST metrics.

Regression coverage for #29141: opaque identifier segments embedded deep in a path
(e.g. Sigma's /workbooks/{id}/lineage/elements/{elementId}) must collapse to {id} so
the cardinality of "source_api_calls" stays bounded.
"""

import pytest

from metadata.ingestion.connections.source_api_client import (
    _is_id_segment,
    normalize_api_path,
)


@pytest.mark.parametrize(
    "segment",
    [
        "12345",  # numeric id
        "3f2a1b4c-1111-2222-3333-444455556666",  # uuid (dashed)
        "3f2a1b4c11112222333344445555666a",  # uuid (no dashes, 32 hex)
        "507f1f77bcf86cd799439011",  # mongo objectid (24 hex)
        "_8j4kP9x",  # sigma-style opaque token with digits
        "pg-9f2a1",  # hyphenated id with digits
        "elem123abc",  # alphanumeric element id
    ],
)
def test_should_treat_token_as_id_when_segment_is_identifier(segment):
    assert _is_id_segment(segment) is True


@pytest.mark.parametrize(
    "segment",
    [
        "workbooks",
        "lineage",
        "elements",
        "pages",
        "queries",
        "members",
        "files",
        "auth",
        "token",
        "v1",  # api version, not an id
        "v2",
        "ab",  # too short, no digit
    ],
)
def test_should_preserve_segment_when_not_an_identifier(segment):
    assert _is_id_segment(segment) is False


@pytest.mark.parametrize(
    "raw_path,expected",
    [
        # The Sigma paths that caused the field explosion in #29141
        (
            "/workbooks/3f2a1b4c-1111-2222-3333-444455556666/lineage/elements/_8j4kP9x",
            "/workbooks/{id}/lineage/elements/{id}",
        ),
        (
            "/workbooks/2hQ9xAbc123/pages/pg-9f2a1/elements",
            "/workbooks/{id}/pages/{id}/elements",
        ),
        ("/files/node-12ab", "/files/{id}"),
        ("/members/12345", "/members/{id}"),
        # No identifier segments -> unchanged
        ("/workbooks", "/workbooks"),
        ("/auth/token", "/auth/token"),
        # API version segments are preserved
        ("/v1/workbooks", "/v1/workbooks"),
        # Query strings are stripped
        ("/workbooks?page=2", "/workbooks"),
        # Edge cases
        ("/", "/"),
        ("", "/"),
    ],
)
def test_should_normalize_identifier_segments_when_extracting_api_path(raw_path, expected):
    assert normalize_api_path(raw_path) == expected
