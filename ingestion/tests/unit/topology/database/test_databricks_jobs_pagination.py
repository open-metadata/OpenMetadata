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
FakeJobsApi reproduces the Databricks Jobs API 2.2 contract as measured against a live
workspace, including the parts the published docs do not describe:

  * `offset` is capped at 1000, and going past it returns a 400 whose body is valid
    JSON, so a client that skips status_code reads it as an ordinary empty response
  * list responses carry at most 100 tasks per job and flag the rest with a per-job
    `has_more`, which only `jobs/get` with a page token can satisfy
  * `expand_tasks` is honoured as "true" but ignored as "True", which is what requests
    makes of a Python bool in a query string

The client is pinned to 2.2 because 2.1 answers 200 with `settings.tasks` missing
entirely for a job above that cap, giving no way to detect or recover the rest.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
)
from metadata.ingestion.source.database.databricks.client import (
    DatabricksClient,
    DatabricksClientException,
)

OFFSET_MAX = 1000
TASKS_PER_PAGE = 100


def _response(status_code: int, payload: dict) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.text = json.dumps(payload)
    response.json.return_value = payload
    return response


class FakeJobsApi:
    """
    Databricks Jobs API 2.2, as measured.

    It still rejects an out-of-range `offset` even though the client no longer sends
    one. That is deliberate: it makes any return to offset pagination fail loudly here
    rather than silently cap out in production.
    """

    def __init__(self, total_jobs: int = 3000, runs: int = 0, tasks_on_first_job: int = 1):
        self.tasks = [{"task_key": f"t{i:03d}"} for i in range(tasks_on_first_job)]
        self.jobs = [
            {
                "job_id": 1_000_000 + i,
                "settings": {"name": f"job-{i:04d}"},
            }
            for i in range(total_jobs)
        ]
        self.runs = [{"run_id": 9_000_000 + i, "start_time": 1_700_000_000_000 - i} for i in range(runs)]
        self.requests: list[dict] = []

    def _expand(self, job: dict) -> dict:
        """Attach tasks the way the API does, honouring the 100-element page."""
        if job["job_id"] != self.jobs[0]["job_id"]:
            return job
        expanded = {**job, "settings": {**job["settings"], "tasks": self.tasks[:TASKS_PER_PAGE]}}
        if len(self.tasks) > TASKS_PER_PAGE:
            expanded["has_more"] = True
        return expanded

    def get(self, url, headers=None, data=None, params=None, timeout=None):
        args = json.loads(data) if data else dict(params or {})
        self.requests.append({"url": url, **args})

        if url.endswith("/jobs/get"):
            return self._get_job(args)

        items = self.runs if url.endswith("/runs/list") else self.jobs
        key = "runs" if url.endswith("/runs/list") else "jobs"

        if "offset" in args and int(args["offset"]) > OFFSET_MAX:
            return _response(
                400,
                {
                    "error_code": "INVALID_PARAMETER_VALUE",
                    "message": (
                        f"The supplied offset {args['offset']} has exceeded the value of {OFFSET_MAX} "
                        f"allowed for this parameter.Please use the page_token parameter to paginate"
                    ),
                },
            )

        start = int(args.get("offset", args.get("page_token", 0)))
        limit = int(args.get("limit", 20))
        page = items[start : start + limit]
        # Case-sensitive on purpose: Databricks ignores "True" (what requests makes of
        # a Python bool in a query string) and only honours "true".
        if key == "jobs" and args.get("expand_tasks") in (True, "true"):
            page = [self._expand(job) for job in page]

        payload = {key: page}
        if start + limit < len(items):
            payload["next_page_token"] = str(start + limit)
        return _response(200, payload)

    def _get_job(self, args: dict) -> MagicMock:
        job = next((j for j in self.jobs if j["job_id"] == int(args["job_id"])), None)
        if job is None:
            return _response(400, {"error_code": "RESOURCE_DOES_NOT_EXIST", "message": "no such job"})
        start = int(args.get("page_token", 0))
        page = self.tasks[start : start + TASKS_PER_PAGE]
        payload = {**job, "settings": {**job["settings"], "tasks": page}}
        if start + TASKS_PER_PAGE < len(self.tasks):
            payload["next_page_token"] = str(start + TASKS_PER_PAGE)
        return _response(200, payload)


def build_client(fake: FakeJobsApi) -> DatabricksClient:
    config = MagicMock(spec=DatabricksPipelineConnection)
    config.hostPort = "dbc-test.cloud.databricks.com"
    config.connectionTimeout = 120
    client = DatabricksClient(config)
    client.client = fake
    return client


@pytest.fixture
def _no_auth():
    """Pagination is what is under test here, not the auth header."""
    with patch.object(DatabricksClient, "headers", new_callable=lambda: property(lambda self: {})):
        yield


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_reaches_past_the_offset_cap():
    fake = FakeJobsApi(total_jobs=3000)

    jobs = list(build_client(fake).list_jobs())

    assert len(jobs) == 3000
    assert jobs[0]["settings"]["name"] == "job-0000"
    assert jobs[-1]["settings"]["name"] == "job-2999"


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_paginates_by_token_not_offset():
    """`offset` is the parameter Databricks caps, so the client must stop sending it."""
    fake = FakeJobsApi(total_jobs=3000)

    list(build_client(fake).list_jobs())

    assert not any("offset" in request for request in fake.requests)
    listings = [r for r in fake.requests if r["url"].endswith("/jobs/list")]
    assert listings, "expected at least one jobs/list request"
    assert all(request.get("limit") == 100 for request in listings)
    # "True" is what requests makes of a Python bool, and Databricks ignores it.
    assert all(request.get("expand_tasks") == "true" for request in listings)


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_below_the_cap():
    """Small workspaces never hit the wall, so guard against regressing them."""
    fake = FakeJobsApi(total_jobs=250)

    assert len(list(build_client(fake).list_jobs())) == 250


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_raises_instead_of_truncating_on_an_api_error():
    """
    Silent truncation is the expensive half of this bug. A short job list does not
    just skip jobs, it lets mark-deleted remove ones that are still there, so a
    failed page has to fail the run.
    """
    fake = FakeJobsApi(total_jobs=3000)
    fake.get = MagicMock(return_value=_response(429, {"error_code": "REQUEST_LIMIT_EXCEEDED", "message": "slow down"}))

    with pytest.raises(DatabricksClientException, match="429"):
        list(build_client(fake).list_jobs())


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_surfaces_a_failure_partway_through_pagination():
    """Half a job list must not be reported as a whole one."""
    fake = FakeJobsApi(total_jobs=3000)
    healthy = fake.get
    calls = {"n": 0}

    def fail_on_the_fifth_page(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 5:
            return _response(500, {"error_code": "INTERNAL_ERROR", "message": "boom"})
        return healthy(*args, **kwargs)

    fake.get = fail_on_the_fifth_page

    with pytest.raises(DatabricksClientException):
        list(build_client(fake).list_jobs())


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_pages_the_task_list_of_a_large_job():
    """
    jobs/list returns at most 100 tasks per job and flags the rest with a per-job
    has_more. Without following it, a 250-task job is ingested with 100 tasks, and
    pipeline lineage is built from the task list.
    """
    fake = FakeJobsApi(total_jobs=1, tasks_on_first_job=250)

    jobs = list(build_client(fake).list_jobs())

    assert len(jobs) == 1
    tasks = jobs[0]["settings"]["tasks"]
    assert len(tasks) == 250
    assert [t["task_key"] for t in tasks[:2]] == ["t000", "t001"]
    assert tasks[-1]["task_key"] == "t249"


@pytest.mark.usefixtures("_no_auth")
def test_list_jobs_leaves_small_task_lists_alone():
    """A job under the cap must not trigger a second jobs/get round trip."""
    fake = FakeJobsApi(total_jobs=1, tasks_on_first_job=12)

    jobs = list(build_client(fake).list_jobs())

    assert len(jobs[0]["settings"]["tasks"]) == 12
    assert not any(r["url"].endswith("/jobs/get") for r in fake.requests)


@pytest.mark.usefixtures("_no_auth")
def test_get_job_runs_paginates_by_token():
    """
    runs/list drops the root has_more in 2.2 exactly as jobs/list does, and the client
    reads it with a bare subscript today. Token pagination removes that landmine and
    the duplicate boundary run that start_time_to paging produced.
    """
    fake = FakeJobsApi(total_jobs=1, runs=120)

    runs = list(build_client(fake).get_job_runs(job_id=1_000_000))

    assert len(runs) == 120
    assert len({run["run_id"] for run in runs}) == 120, "boundary runs must not be yielded twice"


@pytest.mark.usefixtures("_no_auth")
def test_get_job_runs_respects_the_limit_ceiling():
    """runs/list rejects any limit above 26, unlike jobs/list which allows 100."""
    fake = FakeJobsApi(total_jobs=1, runs=120)

    list(build_client(fake).get_job_runs(job_id=1_000_000))

    listings = [r for r in fake.requests if r["url"].endswith("/runs/list")]
    assert listings, "expected at least one runs/list request"
    assert all(int(request.get("limit", 0)) <= 26 for request in listings)


@pytest.mark.usefixtures("_no_auth")
def test_expanded_job_no_longer_advertises_more_tasks():
    """`has_more` is the signal to go fetch the rest, so it must not survive the fetch."""
    fake = FakeJobsApi(total_jobs=1, tasks_on_first_job=250)

    job = next(iter(build_client(fake).list_jobs()))

    assert "has_more" not in job


@pytest.mark.usefixtures("_no_auth")
def test_a_failed_task_page_degrades_that_job_without_failing_the_run():
    """
    Losing page two of one job's tasks costs that job an accurate task list. Failing
    the whole run over it would cost the catalogue every other job, so this one
    deliberately degrades where list_jobs raises.
    """
    fake = FakeJobsApi(total_jobs=3, tasks_on_first_job=250)
    healthy = fake.get

    def fail_only_jobs_get(url, **kwargs):
        if url.endswith("/jobs/get"):
            return _response(503, {"error_code": "TEMPORARILY_UNAVAILABLE", "message": "try later"})
        return healthy(url, **kwargs)

    fake.get = fail_only_jobs_get

    jobs = list(build_client(fake).list_jobs())

    assert len(jobs) == 3, "the other jobs must still be ingested"
    assert len(jobs[0]["settings"]["tasks"]) == TASKS_PER_PAGE, "the first page is kept"


@pytest.mark.usefixtures("_no_auth")
def test_test_connection_passes_on_a_reachable_workspace():
    fake = FakeJobsApi(total_jobs=3)

    build_client(fake).list_jobs_test_connection()

    assert fake.requests[0]["limit"] == 1, "the probe must not pull a full page"


@pytest.mark.usefixtures("_no_auth")
def test_test_connection_raises_on_an_unreachable_workspace():
    """The GetPipelines step has to fail loudly, it is what tells a user their token is wrong."""
    fake = FakeJobsApi(total_jobs=3)
    fake.get = MagicMock(return_value=_response(403, {"error_code": "PERMISSION_DENIED", "message": "nope"}))

    with pytest.raises(DatabricksClientException, match="403"):
        build_client(fake).list_jobs_test_connection()


@pytest.mark.usefixtures("_no_auth")
def test_a_repeated_page_token_stops_instead_of_looping():
    """A service that hands back the token it was given must not spin forever."""
    fake = FakeJobsApi(total_jobs=3000)
    calls = {"n": 0}

    def always_the_same_token(url, **kwargs):
        calls["n"] += 1
        assert calls["n"] < 50, "pagination looped instead of stopping"
        return _response(200, {"jobs": [{"job_id": 1}], "next_page_token": "stuck"})

    fake.get = always_the_same_token

    jobs = list(build_client(fake).list_jobs())

    assert len(jobs) == 2, "one page, then the repeat is detected and pagination stops"
