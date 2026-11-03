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
Unit tests for OMetaPipelineMixin.list_pipeline_statuses.

The server bounds a status page by size as well as by limit, so the client follows
paging.after to return the statuses a caller asked for.
"""

from unittest.mock import MagicMock

from metadata.ingestion.ometa.mixins.pipeline_mixin import OMetaPipelineMixin

FQN = "airflow.etl"
CURSOR = "MTAwMA=="


class _Client(OMetaPipelineMixin):
    def get_suffix(self, entity):
        return "/pipelines"


def _page(timestamps: list[int], after: str | None = None) -> dict:
    return {
        "data": [{"timestamp": ts, "executionStatus": "Successful"} for ts in timestamps],
        "paging": {"total": 5, "after": after},
    }


def _make_client(*pages: dict) -> _Client:
    client = _Client()
    client.client = MagicMock()
    client.client.get.side_effect = list(pages)
    return client


def test_follows_after_cursor_until_exhausted_without_limit():
    client = _make_client(_page([5, 4, 3], after=CURSOR), _page([2, 1]))

    statuses = client.list_pipeline_statuses(FQN, start_ts=0, end_ts=10)

    assert [status.timestamp.root for status in statuses] == [5, 4, 3, 2, 1]
    second_path = client.client.get.call_args_list[1].args[0]
    assert second_path == "/pipelines/airflow.etl/status?startTs=0&endTs=10&after=MTAwMA%3D%3D"


def test_requests_only_the_remainder_of_the_limit():
    client = _make_client(_page([5, 4], after=CURSOR), _page([3]))

    statuses = client.list_pipeline_statuses(FQN, start_ts=0, end_ts=10, limit=3)

    assert [status.timestamp.root for status in statuses] == [5, 4, 3]
    first_path, second_path = (call.args[0] for call in client.client.get.call_args_list)
    assert first_path.endswith("&limit=3")
    assert second_path.endswith("&limit=1&after=MTAwMA%3D%3D")


def test_stops_once_the_limit_is_reached_even_with_a_cursor():
    client = _make_client(_page([5, 4], after=CURSOR))

    statuses = client.list_pipeline_statuses(FQN, start_ts=0, end_ts=10, limit=2)

    assert len(statuses) == 2
    assert client.client.get.call_count == 1


def test_returns_empty_list_when_the_server_returns_nothing():
    client = _make_client(None)

    assert client.list_pipeline_statuses(FQN, start_ts=0, end_ts=10) == []
