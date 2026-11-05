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
Unit tests for OMetaPipelineMixin.

Covers:
  - list_pipeline_statuses without a limit reads the whole range page by page,
    since the server returns at most one page per request.
  - list_pipeline_statuses with a limit within one page reads a single page.
  - list_pipeline_statuses with a limit above one page reads pages until the
    limit, never asking for more than the server's largest page.
"""

from unittest.mock import MagicMock

from metadata.ingestion.ometa.mixins.pipeline_mixin import (
    MAX_PIPELINE_STATUS_PAGE_SIZE,
    OMetaPipelineMixin,
)

STATUS_PATH = "/pipelines/service.pipeline/status"


class _Client(OMetaPipelineMixin):
    def get_suffix(self, entity):
        return "/pipelines"


def _page(length: int, after: str | None = None) -> dict:
    return {
        "data": [{"timestamp": index, "executionStatus": "Successful"} for index in range(length)],
        "paging": {"after": after, "total": length},
    }


def _make_client(*pages: dict) -> _Client:
    client = _Client()
    client.client = MagicMock()
    client.client.get.side_effect = list(pages)
    return client


def _requested_paths(client: _Client) -> list[str]:
    return [call.args[0] for call in client.client.get.call_args_list]


def test_list_pipeline_statuses_without_limit_reads_every_page():
    client = _make_client(_page(MAX_PIPELINE_STATUS_PAGE_SIZE, "older"), _page(3, "oldest"))

    statuses = client.list_pipeline_statuses("service.pipeline", start_ts=1, end_ts=2)

    assert len(statuses) == MAX_PIPELINE_STATUS_PAGE_SIZE + 3
    assert _requested_paths(client) == [
        f"{STATUS_PATH}?startTs=1&endTs=2&limit={MAX_PIPELINE_STATUS_PAGE_SIZE}",
        f"{STATUS_PATH}?startTs=1&endTs=2&limit={MAX_PIPELINE_STATUS_PAGE_SIZE}&after=older",
    ]


def test_list_pipeline_statuses_with_limit_reads_one_page():
    client = _make_client(_page(5, "older"))

    statuses = client.list_pipeline_statuses("service.pipeline", start_ts=1, end_ts=2, limit=5)

    assert len(statuses) == 5
    assert _requested_paths(client) == [f"{STATUS_PATH}?startTs=1&endTs=2&limit=5"]


def test_list_pipeline_statuses_with_limit_above_one_page_reads_until_the_limit():
    client = _make_client(_page(MAX_PIPELINE_STATUS_PAGE_SIZE, "older"), _page(500, "oldest"))

    statuses = client.list_pipeline_statuses("service.pipeline", start_ts=1, end_ts=2, limit=1500)

    assert len(statuses) == 1500
    assert _requested_paths(client) == [
        f"{STATUS_PATH}?startTs=1&endTs=2&limit={MAX_PIPELINE_STATUS_PAGE_SIZE}",
        f"{STATUS_PATH}?startTs=1&endTs=2&limit=500&after=older",
    ]
