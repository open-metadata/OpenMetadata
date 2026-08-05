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
PowerBI pagination tests using a mock HTTP server

``PowerBiApiClient.pagination_entity_per_page`` was raised from ``min(100, ...)`` to
``min(5000, ...)`` so a large tenant drains ``GetGroups`` / ``GetGroupsAsAdmin`` in far
fewer requests instead of exhausting the endpoint's rate limit.

The raise is only safe because the ceiling is scoped to the groups endpoint, which
documents ``$top`` up to 5000. Everything else the connector calls is either an
unpaginated collection or the admin ``workspaces/getInfo`` scan, which takes at most
100 workspace ids per call and is capped independently in ``powerbi/metadata.py``.

So these tests pin, against the requests the server actually receives:

1. the schema default (100) is unchanged - the raise widens the ceiling, it does not
   change what an unconfigured service does;
2. the configured page size reaches the groups endpoint as ``$top``, for the regular
   and the admin variant, including on the failed-page retry pass;
3. no other endpoint is ever paged, and workspace scans still batch at 100.
"""

import inspect
import math

import pytest

from metadata.ingestion.source.dashboard.powerbi.client import GETGROUPS_DEFAULT_PARAMS

# The ``$top`` ceiling documented for GetGroups / GetGroupsAsAdmin.
GROUPS_PAGE_SIZE_CEILING = 5000

# Power BI accepts at most 100 workspace ids per admin ``workspaces/getInfo`` call.
WORKSPACE_SCAN_BATCH_CEILING = 100

# The ``pagination_entity_per_page`` default declared in powerBIConnection.json.
SCHEMA_DEFAULT_PAGE_SIZE = 100

# Enough workspaces to need several pages at 5000 and many more at 100.
LARGE_TENANT_WORKSPACES = 12_000


def required_args(method) -> list[str]:
    """A stub value per required parameter - every client fetch takes plain id strings."""
    return [
        "stub"
        for parameter in inspect.signature(method).parameters.values()
        if parameter.default is inspect.Parameter.empty
    ]


class TestPaginationPageSizeResolution:
    """``min(GROUPS_PAGE_SIZE_CEILING, config.pagination_entity_per_page)``."""

    def test_schema_default_is_unchanged(self, powerbi_api_client):
        """An unconfigured service still pages 100 at a time - the raise only widens the ceiling."""
        assert powerbi_api_client().pagination_entity_per_page == SCHEMA_DEFAULT_PAGE_SIZE

    @pytest.mark.parametrize(
        "configured, expected",
        [
            (1, 1),
            (100, 100),
            (101, 101),
            (1000, 1000),
            (GROUPS_PAGE_SIZE_CEILING, GROUPS_PAGE_SIZE_CEILING),
            (GROUPS_PAGE_SIZE_CEILING + 1, GROUPS_PAGE_SIZE_CEILING),
            (100_000, GROUPS_PAGE_SIZE_CEILING),
        ],
        ids=[
            "one",
            "old-ceiling",
            "just-above-old-ceiling",
            "below-ceiling",
            "at-ceiling",
            "just-above-ceiling",
            "far-above-ceiling",
        ],
    )
    def test_page_size_is_clamped_to_the_groups_ceiling(self, powerbi_api_client, configured, expected):
        assert powerbi_api_client(page_size=configured).pagination_entity_per_page == expected


class TestGroupsEndpointPagination:
    """The resolved page size has to reach ``GetGroups`` as a ``$top`` query param."""

    def test_probe_call_asks_for_a_single_group(self, powerbi_server, powerbi_api_client):
        """The count probe stays at ``$top=1`` - it exists to read ``@odata.count`` cheaply."""
        powerbi_api_client(page_size=GROUPS_PAGE_SIZE_CEILING).fetch_all_workspaces()

        probe = powerbi_server.requests[0]
        assert probe.path == "/v1.0/myorg/groups"
        assert probe.query == GETGROUPS_DEFAULT_PARAMS

    @pytest.mark.parametrize(
        "configured, expected_top, workspace_total",
        [
            (None, SCHEMA_DEFAULT_PAGE_SIZE, 250),
            (GROUPS_PAGE_SIZE_CEILING, GROUPS_PAGE_SIZE_CEILING, LARGE_TENANT_WORKSPACES),
            (GROUPS_PAGE_SIZE_CEILING + 1, GROUPS_PAGE_SIZE_CEILING, LARGE_TENANT_WORKSPACES),
        ],
        ids=["default-100", "raised-to-5000", "clamped-to-5000"],
    )
    def test_groups_pages_use_the_resolved_page_size(
        self, powerbi_server, powerbi_api_client, configured, expected_top, workspace_total
    ):
        powerbi_server.workspace_total = workspace_total

        workspaces = powerbi_api_client(page_size=configured).fetch_all_workspaces()

        expected_pages = math.ceil(workspace_total / expected_top)
        assert [(page.top, page.skip) for page in powerbi_server.group_page_requests] == [
            (expected_top, index * expected_top) for index in range(expected_pages)
        ]
        assert [workspace.id for workspace in workspaces] == [f"ws-{index}" for index in range(workspace_total)]

    @pytest.mark.parametrize(
        "configured, expected_pages",
        [(None, 120), (GROUPS_PAGE_SIZE_CEILING, 3)],
        ids=["default-100", "raised-to-5000"],
    )
    def test_raised_page_size_cuts_the_request_count(
        self, powerbi_server, powerbi_api_client, configured, expected_pages
    ):
        """The point of the change: 12k workspaces in 3 calls instead of 120."""
        powerbi_server.workspace_total = LARGE_TENANT_WORKSPACES

        powerbi_api_client(page_size=configured).fetch_all_workspaces()

        assert len(powerbi_server.group_page_requests) == expected_pages

    def test_admin_groups_endpoint_uses_the_raised_page_size(self, powerbi_server, powerbi_api_client):
        """``useAdminApis`` swaps the path to ``/myorg/admin/groups``; the ``$top`` must follow."""
        powerbi_server.workspace_total = 7_500

        powerbi_api_client(page_size=GROUPS_PAGE_SIZE_CEILING, use_admin_apis=True).fetch_all_workspaces()

        assert {request.path for request in powerbi_server.requests} == {"/v1.0/myorg/admin/groups"}
        assert [page.top for page in powerbi_server.group_page_requests] == [
            GROUPS_PAGE_SIZE_CEILING,
            GROUPS_PAGE_SIZE_CEILING,
        ]

    def test_throttled_page_is_retried_at_the_same_page_size(self, powerbi_server, powerbi_api_client):
        """The retry pass replays the recorded params, so it must not silently re-page at 100."""
        powerbi_server.workspace_total = 10_000
        powerbi_server.fail_group_page_at_skip = GROUPS_PAGE_SIZE_CEILING

        workspaces = powerbi_api_client(page_size=GROUPS_PAGE_SIZE_CEILING).fetch_all_workspaces()

        retry = powerbi_server.requests[-1]
        assert (retry.top, retry.skip) == (GROUPS_PAGE_SIZE_CEILING, GROUPS_PAGE_SIZE_CEILING)
        assert len(workspaces) == 10_000


class TestPageSizeIsScopedToTheGroupsEndpoint:
    """Nothing but ``GetGroups`` may page above 100."""

    @pytest.mark.parametrize("use_admin_apis", [False, True], ids=["org-apis", "admin-apis"])
    def test_no_endpoint_other_than_groups_is_ever_paginated(self, powerbi_server, powerbi_api_client, use_admin_apis):
        """Sweep every ``fetch_*`` on the client and inspect what reached the server.

        Driven by reflection rather than a hand-written list so an endpoint added
        later is covered without anyone remembering to extend this test.
        """
        powerbi_server.workspace_total = 1
        api_client = powerbi_api_client(page_size=GROUPS_PAGE_SIZE_CEILING, use_admin_apis=use_admin_apis)

        for name, method in inspect.getmembers(api_client, inspect.ismethod):
            if not name.startswith("fetch_"):
                continue
            before = len(powerbi_server.requests)
            method(*required_args(method))
            assert len(powerbi_server.requests) > before, f"{name} issued no request; the sweep would miss it"

        non_groups = [request for request in powerbi_server.requests if not request.is_groups]
        assert non_groups, "the sweep only exercised the groups endpoint"
        for request in non_groups:
            assert request.top is None, f"{request.path} was paginated with $top={request.top}"
            assert request.skip is None

    def test_workspace_scans_still_batch_at_100(self, powerbi_server, powerbi_source):
        """A 5000-per-page config must still post at most 100 workspace ids per scan."""
        powerbi_server.workspace_total = 250
        source = powerbi_source(page_size=GROUPS_PAGE_SIZE_CEILING)

        workspaces = list(source.get_admin_workspace_data())

        batch_sizes = [len(batch) for batch in powerbi_server.scan_batches.values()]
        assert batch_sizes == [100, 100, 50]
        assert max(batch_sizes) <= WORKSPACE_SCAN_BATCH_CEILING
        assert len(workspaces) == 250

    def test_workspaces_are_still_fetched_at_the_raised_page_size(self, powerbi_server, powerbi_source):
        """The 100-id scan batching must not drag the groups page size back down with it."""
        powerbi_server.workspace_total = 250
        source = powerbi_source(page_size=GROUPS_PAGE_SIZE_CEILING)

        list(source.get_admin_workspace_data())

        assert [page.top for page in powerbi_server.group_page_requests] == [GROUPS_PAGE_SIZE_CEILING]
