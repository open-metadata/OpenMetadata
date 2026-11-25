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
Unit tests for ``metadata.utils.s3_utils.list_s3_objects``.

The helper used to wrap its entire generator body in a bare ``except Exception``
that only logged a warning and then terminated the generator, so AWS listing
errors were indistinguishable from a healthy empty listing for every caller.
These tests verify errors now propagate.
"""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError

from metadata.utils.s3_utils import list_s3_objects


def _client_error(code: str, operation: str = "ListObjectsV2") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": code}}, operation)


def _make_client(pages=None, paginate_side_effect=None) -> MagicMock:
    """Build a mock boto3 S3 client with a paginator chain.

    ``pages`` is a plain list of page dicts used as ``paginate.return_value``.
    ``paginate_side_effect`` can be a callable (generator factory) or an
    exception instance to raise.
    """
    client = MagicMock()
    paginator = MagicMock()
    if paginate_side_effect is not None:
        paginator.paginate.side_effect = paginate_side_effect
    elif pages is not None:
        paginator.paginate.return_value = pages
    client.get_paginator.return_value = paginator
    return client


class TestListS3ObjectsHappyPath:
    def test_yields_contents_from_single_page(self):
        client = _make_client(pages=[{"Contents": [{"Key": "a"}, {"Key": "b"}]}])
        result = list(list_s3_objects(client, Bucket="bkt"))
        assert result == [{"Key": "a"}, {"Key": "b"}]

    def test_yields_contents_from_multiple_pages(self):
        client = _make_client(
            pages=[
                {"Contents": [{"Key": "a"}, {"Key": "b"}]},
                {"Contents": [{"Key": "c"}]},
                {"Contents": [{"Key": "d"}, {"Key": "e"}]},
            ]
        )
        result = list(list_s3_objects(client, Bucket="bkt"))
        assert result == [{"Key": "a"}, {"Key": "b"}, {"Key": "c"}, {"Key": "d"}, {"Key": "e"}]

    def test_missing_contents_key_yields_nothing_for_that_page(self):
        client = _make_client(
            pages=[
                {"Contents": [{"Key": "a"}]},
                {"Other": []},
                {"Contents": [{"Key": "b"}]},
            ]
        )
        result = list(list_s3_objects(client, Bucket="bkt"))
        assert result == [{"Key": "a"}, {"Key": "b"}]

    def test_all_empty_pages_yields_nothing(self):
        client = _make_client(pages=[{"Other": []}, {"Other": []}])
        assert list(list_s3_objects(client, Bucket="bkt")) == []

    def test_no_pages_yields_nothing(self):
        client = _make_client(pages=[])
        assert list(list_s3_objects(client, Bucket="bkt")) == []

    def test_returns_generator(self):
        client = _make_client(pages=[{"Contents": [{"Key": "a"}]}])
        result = list_s3_objects(client, Bucket="bkt")
        assert isinstance(result, Iterator)

    def test_passes_kwargs_through_to_paginate(self):
        client = _make_client(pages=[{"Contents": []}])
        list(list_s3_objects(client, Bucket="bkt", Prefix="data/"))
        client.get_paginator.assert_called_once_with("list_objects_v2")
        client.get_paginator.return_value.paginate.assert_called_once_with(Bucket="bkt", Prefix="data/")


class TestListS3ObjectsErrorPropagation:
    """Errors from the paginator must propagate, not be swallowed."""

    def test_get_paginator_failure_propagates(self):
        client = MagicMock()
        client.get_paginator.side_effect = _client_error("InternalError", "GetPaginator")
        with pytest.raises(ClientError):
            list(list_s3_objects(client, Bucket="bkt"))

    def test_client_error_on_first_page_propagates(self):
        client = _make_client(paginate_side_effect=_client_error("AccessDenied"))
        with pytest.raises(ClientError) as exc_info:
            list(list_s3_objects(client, Bucket="bkt"))
        assert exc_info.value.response["Error"]["Code"] == "AccessDenied"

    def test_client_error_no_such_bucket_propagates(self):
        client = _make_client(paginate_side_effect=_client_error("NoSuchBucket"))
        with pytest.raises(ClientError) as exc_info:
            list(list_s3_objects(client, Bucket="missing-bucket"))
        assert exc_info.value.response["Error"]["Code"] == "NoSuchBucket"

    def test_no_credentials_error_propagates(self):
        client = _make_client(paginate_side_effect=NoCredentialsError())
        with pytest.raises(NoCredentialsError):
            list(list_s3_objects(client, Bucket="bkt"))

    def test_botocore_error_propagates(self):
        client = _make_client(paginate_side_effect=BotoCoreError())
        with pytest.raises(BotoCoreError):
            list(list_s3_objects(client, Bucket="bkt"))

    def test_error_mid_pagination_propagates_after_partial_yield(self):
        """The paginator yields lazily, so the error can arrive after the first
        page has been consumed. The already-yielded objects are returned, but the
        error still propagates — the caller is not left with a silently
        truncated listing."""

        def _pages(**_):
            yield {"Contents": [{"Key": "a"}, {"Key": "b"}]}
            yield {"Contents": [{"Key": "c"}]}
            raise _client_error("AccessDenied")

        client = _make_client(paginate_side_effect=_pages)
        collected: list = []
        with pytest.raises(ClientError) as exc_info:
            for obj in list_s3_objects(client, Bucket="bkt"):
                collected.append(obj)  # noqa: PERF402
        # Objects from the first two pages were yielded before the error.
        assert [o["Key"] for o in collected] == ["a", "b", "c"]
        assert exc_info.value.response["Error"]["Code"] == "AccessDenied"

    def test_error_after_yield_does_not_silently_terminate(self):
        """Regression guard: previously, an error mid-pagination was swallowed and
        the generator ended cleanly — callers saw a truncated list with no error.
        Now the error propagates."""

        def _pages(**_):
            yield {"Contents": [{"Key": "a"}]}
            raise _client_error("Throttling")

        client = _make_client(paginate_side_effect=_pages)
        # The generator must raise, not silently return a partial result.
        gen = list_s3_objects(client, Bucket="bkt")
        assert next(gen) == {"Key": "a"}
        with pytest.raises(ClientError):
            next(gen)
