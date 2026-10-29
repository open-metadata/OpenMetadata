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
Error-classification tests for the dbt config sources.

These cover the branches that translate a provider exception into a
DBTConfigException message shown to the user.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
import requests
from botocore.exceptions import ClientError, NoCredentialsError

from metadata.generated.schema.metadataIngestion.dbtconfig.dbtAzureConfig import (
    DbtAzureConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtCloudConfig import (
    DbtCloudConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtS3Config import (
    DbtS3Config,
)
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.source.database.dbt.dbt_config import (
    DBTConfigException,
    get_dbt_details,
)


def _dbt_cloud_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtCloudConfig handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtCloudConfig
    config.dbtCloudAccountId = "12345"
    config.dbtCloudProjectId = None
    config.dbtCloudJobId = None
    config.dbtCloudIngestAllJobs = False
    config.dbtCloudUrl = "https://cloud.getdbt.com"
    config.dbtCloudAuthToken.get_secret_value.return_value = "tok"
    return config


def _http_error(status_code: int) -> requests.HTTPError:
    """A requests.HTTPError as raise_for_status builds it, which is what reaches the dbt
    Cloud handler when the error body has no top-level "code" key for the REST client to
    turn into an APIError."""
    response = requests.Response()
    response.status_code = status_code
    response.url = "https://cloud.getdbt.com/api/v2/accounts/12345/runs"
    response.reason = "Unauthorized"
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        return exc
    raise AssertionError(f"status {status_code} did not raise")


class TestDbtCloudErrorClassification:
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_401_api_error_reports_invalid_token(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = APIError({"code": 401, "message": "unauthorized"})

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "auth token" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_404_api_error_reports_bad_account_id(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = APIError({"code": 404, "message": "not found"})

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "account ID '12345' not found" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_transport_error_reports_connectivity(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = RestTransportError("GET", "/runs", Exception("refused"))

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "Unable to connect to dbt Cloud" in str(exc_info.value)

    @pytest.mark.parametrize("status_code", [401, 403])
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_reports_invalid_token(self, tracked_rest, status_code):
        """dbt Cloud nests its error code under "status", and an SSO gateway answers with
        HTML, so neither body reaches the APIError branch - a bare HTTPError does."""
        tracked_rest.return_value.get.side_effect = _http_error(status_code)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "auth token" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_404_reports_bad_account_id(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = _http_error(404)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        # The generic fallback also renders the account ID via the request URL, so assert
        # on the wording that only the 404 branch produces.
        assert "account ID '12345' not found" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_http_error_other_status_falls_back_to_generic(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = _http_error(500)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "error connecting to dbt cloud" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_none_response_is_not_reported_as_no_runs_found(self, tracked_rest):
        """The client returns None for any error body it cannot classify - a 404 on a
        mistyped account ID lands here just as a 401 does - so the message must name the
        account and enumerate the causes rather than assert the token is bad."""
        tracked_rest.return_value.get.return_value = None

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        message = str(exc_info.value).lower()
        assert "no completed dbt runs" not in message
        assert "12345" in message
        assert "account id is wrong" in message
        assert "token is invalid" in message
        assert "rate-limited" in message

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_empty_data_still_reports_no_runs_found(self, tracked_rest):
        tracked_rest.return_value.get.return_value = {"data": []}

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_dbt_cloud_config()))

        assert "no completed dbt runs found for account '12345'" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_no_jobs_in_account_reports_no_jobs_found(self, tracked_rest):
        tracked_rest.return_value.get.return_value = {"data": []}
        config = _dbt_cloud_config()
        config.dbtCloudIngestAllJobs = True

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(config))

        assert "no dbt cloud jobs found for account '12345'" in str(exc_info.value).lower()


def _dbt_cloud_artifacts(run_steps, run_results_by_step):
    """Stand-in for the dbt Cloud API: artifacts for a step absent from
    ``run_results_by_step`` 404, as they do for the clone/profile/deps steps.
    Like the real API, a run lists its steps only when asked to via ``include_related``."""

    def get(path, data=None):
        if path.endswith("/runs"):
            run = {"id": 1, "finished_at_humanized": "now", "duration_humanized": "1m"}
            if run_steps is not None and "run_steps" in (data or {}).get("include_related", ""):
                run["run_steps"] = run_steps
            return {"data": [run]}
        if path.endswith("manifest.json"):
            return {"nodes": {}}
        if path.endswith("run_results.json"):
            # dbt Cloud nests the 404 code under "status", so the REST client returns None, not raises
            return run_results_by_step.get((data or {}).get("step"))
        raise _http_error(404)

    return get


class TestDbtCloudRunResultsSteps:
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_reads_run_results_from_every_step(self, tracked_rest):
        """`dbt test` as step 7 of 8: the endpoint's default (last step) holds no tests."""
        test_step = {"results": [{"unique_id": "test.p.not_null"}]}
        last_step = {"results": [{"unique_id": "model.p.m"}]}
        tracked_rest.return_value.get.side_effect = _dbt_cloud_artifacts(
            run_steps=[{"index": index} for index in range(1, 9)],
            run_results_by_step={7: test_step, 8: last_step},
        )

        (dbt_files,) = get_dbt_details(_dbt_cloud_config())

        assert dbt_files.dbt_run_results == [test_step, last_step]

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_without_step_details_falls_back_to_last_step(self, tracked_rest):
        last_step = {"results": [{"unique_id": "test.p.not_null"}]}
        tracked_rest.return_value.get.side_effect = _dbt_cloud_artifacts(
            run_steps=None, run_results_by_step={None: last_step}
        )

        (dbt_files,) = get_dbt_details(_dbt_cloud_config())

        assert dbt_files.dbt_run_results == [last_step]

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_no_run_results_in_any_step_skips_tests(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = _dbt_cloud_artifacts(
            run_steps=[{"index": 1}, {"index": 2}], run_results_by_step={}
        )

        (dbt_files,) = get_dbt_details(_dbt_cloud_config())

        assert dbt_files.dbt_run_results is None


def _model(name, compiled=True):
    node = {"name": name, "resource_type": "model"}
    if compiled:
        node["compiled_code"] = f"select * from {name}_src"
    return node


def _dbt_cloud_jobs_api(runs_by_job, artifacts_by_run=None, jobs_pages=()):
    """Stand-in for the dbt Cloud API: a paginated job list and, per job, its latest run.
    A job absent from ``runs_by_job`` has no completed run, a run absent from
    ``artifacts_by_run`` has a manifest with no nodes, an artifact set to None is missing
    (404) and one set to an int fails with that status; a ``runs_by_job`` value of None
    makes the runs call itself unusable."""
    artifacts_by_run = artifacts_by_run or {}
    total_count = sum(len(page) for page in jobs_pages)
    requested = []

    def get(path, data=None):
        requested.append((path, dict(data or {})))
        if path.endswith("/jobs/"):
            page = jobs_pages[data["offset"] // data["limit"]]
            return {"data": page, "extra": {"pagination": {"count": len(page), "total_count": total_count}}}
        if path.endswith("/runs"):
            job_id = data.get("job_definition_id")
            if job_id in runs_by_job and runs_by_job[job_id] is None:
                return None
            run = runs_by_job.get(job_id)
            if run is None:
                return {"data": []}
            return {"data": [{"finished_at_humanized": "now", "duration_humanized": "1m", **run}]}
        run_id = int(path.split("/runs/")[1].split("/")[0])
        artifacts = artifacts_by_run.get(run_id, {"manifest": {"nodes": {}}})
        for name in ("manifest", "catalog", "run_results"):
            if path.endswith(f"{name}.json"):
                artifact = artifacts.get(name)
                return None if isinstance(artifact, int) else artifact
        raise _http_error(404)

    def get_raw(path, data=None):
        """Like the REST client's get_raw: the response after retries, whatever its status."""
        artifact = get(path, data)
        name = path.rsplit("/", 1)[-1].removesuffix(".json")
        failed_status = (artifacts_by_run.get(int(path.split("/runs/")[1].split("/")[0])) or {}).get(name)
        response = requests.Response()
        response.status_code = failed_status if isinstance(failed_status, int) else 200 if artifact else 404
        response._content = json.dumps(artifact).encode()
        return response

    get.raw = get_raw
    return get, requested


def _serve(tracked_rest, get):
    tracked_rest.return_value.get.side_effect = get
    tracked_rest.return_value.get_raw.side_effect = get.raw


def _cloud_config(job_ids=None, ingest_all_jobs=False, project_id=None):
    config = _dbt_cloud_config()
    config.dbtCloudJobId = job_ids
    config.dbtCloudIngestAllJobs = ingest_all_jobs
    config.dbtCloudProjectId = project_id
    return config


def _runs_requested(requested):
    return [params.get("job_definition_id") for path, params in requested if path.endswith("/runs")]


class TestDbtCloudMultipleJobs:
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_empty_job_id_reads_only_the_latest_run_of_any_job(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(runs_by_job={None: {"id": 1}})
        _serve(tracked_rest, get)

        assert len(list(get_dbt_details(_cloud_config()))) == 1
        assert _runs_requested(requested) == [None]
        assert not any(path.endswith("/jobs/") for path, _ in requested)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_existing_config_without_the_flag_keeps_reading_one_run(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(runs_by_job={None: {"id": 1}})
        _serve(tracked_rest, get)
        config = DbtCloudConfig.model_validate(
            {
                "dbtConfigType": "cloud",
                "dbtCloudAuthToken": "tok",
                "dbtCloudAccountId": "12345",
                "dbtCloudUrl": "https://cloud.getdbt.com",
            }
        )

        assert len(list(get_dbt_details(config))) == 1
        assert _runs_requested(requested) == [None]

    @pytest.mark.parametrize("job_ids", ["70,71", "71,70"])
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_partial_job_does_not_blank_models_a_full_job_compiled(self, tracked_rest, job_ids):
        """Job 70 builds everything and generates docs; job 71 runs one model. Both manifests
        list every model, but only 70's carries orders' SQL and only 70 has a catalog."""
        full_test = {"results": [{"unique_id": "test.p.not_null_orders"}]}
        hourly_test = {"results": [{"unique_id": "test.p.not_null_events"}]}
        catalog = {"nodes": {"model.p.orders": {"columns": {"id": {"type": "int"}}}}, "sources": {}}
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={"70": {"id": 1, "environment_id": 5}, "71": {"id": 2, "environment_id": 5}},
            artifacts_by_run={
                1: {
                    "manifest": {"nodes": {"model.p.orders": _model("orders"), "model.p.events": _model("events")}},
                    "catalog": catalog,
                    "run_results": full_test,
                },
                2: {
                    "manifest": {
                        "nodes": {
                            "model.p.orders": _model("orders", compiled=False),
                            "model.p.events": _model("events"),
                        }
                    },
                    "run_results": hourly_test,
                },
            },
        )
        _serve(tracked_rest, get)

        (dbt_files,) = get_dbt_details(_cloud_config(job_ids=job_ids))

        assert dbt_files.dbt_manifest["nodes"]["model.p.orders"]["compiled_code"] == "select * from orders_src"
        assert dbt_files.dbt_catalog == catalog
        assert sorted(map(str, dbt_files.dbt_run_results)) == sorted(map(str, [hourly_test, full_test]))

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_jobs_of_different_environments_stay_apart(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={
                "70": {"id": 1, "environment_id": 5},
                "71": {"id": 2, "environment_id": 6},
                "72": {"id": 3, "environment_id": 5},
            },
            artifacts_by_run={
                1: {"manifest": {"nodes": {"model.p.orders": _model("orders")}}},
                2: {"manifest": {"nodes": {"model.p.orders": _model("orders_staging")}}},
                3: {"manifest": {"nodes": {"model.p.events": _model("events")}}},
            },
        )
        _serve(tracked_rest, get)

        prod, staging = get_dbt_details(_cloud_config(job_ids=" 70, 71 ,72"))

        assert sorted(prod.dbt_manifest["nodes"]) == ["model.p.events", "model.p.orders"]
        assert staging.dbt_manifest["nodes"]["model.p.orders"]["name"] == "orders_staging"

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_ingest_all_jobs_scans_every_page_of_jobs_except_ci(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(
            jobs_pages=[
                [{"id": job_id, "job_type": "scheduled"} for job_id in range(100)],
                [{"id": 100, "job_type": "ci"}, {"id": 101, "job_type": "other"}],
            ],
            runs_by_job={"0": {"id": 1}, "101": {"id": 2}},
        )
        _serve(tracked_rest, get)

        assert len(list(get_dbt_details(_cloud_config(ingest_all_jobs=True, project_id="9")))) == 1

        run_job_ids = _runs_requested(requested)
        assert "100" not in run_job_ids
        assert len(run_job_ids) == 101
        assert all(params["project_id"] == "9" for path, params in requested if path.endswith("/jobs/"))

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_job_ids_take_precedence_over_ingest_all_jobs(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(runs_by_job={"70": {"id": 1}})
        _serve(tracked_rest, get)

        assert len(list(get_dbt_details(_cloud_config(job_ids="70", ingest_all_jobs=True)))) == 1
        assert _runs_requested(requested) == ["70"]

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_job_without_a_completed_run_is_skipped(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(
            runs_by_job={"71": {"id": 1}}, artifacts_by_run={1: {"manifest": {"nodes": {"model.p.m": _model("m")}}}}
        )
        _serve(tracked_rest, get)

        (dbt_files,) = get_dbt_details(_cloud_config(job_ids="70,71"))

        assert list(dbt_files.dbt_manifest["nodes"]) == ["model.p.m"]
        assert _runs_requested(requested) == ["70", "71"]

    @pytest.mark.parametrize(
        ("runs_by_job", "artifacts_by_run"),
        [
            # the client returns None after exhausting 429 retries, and for dbt Cloud's 401 body
            ({"70": {"id": 1}, "71": None}, {}),
            ({"70": {"id": 1}, "71": {"id": 2}}, {2: {"manifest": None}}),
            ({"70": {"id": 1}, "71": {"id": 2}}, {2: {"manifest": {"nodes": {}}, "catalog": 429}}),
            ({"70": {"id": 1}, "71": {"id": 2}}, {2: {"manifest": {"nodes": {}}, "run_results": 503}}),
        ],
        ids=["unusable_runs_response", "missing_manifest", "catalog_out_of_retries", "run_results_out_of_retries"],
    )
    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_other_job_failures_fail_the_run_instead_of_merging_without_it(
        self, tracked_rest, runs_by_job, artifacts_by_run
    ):
        get, _ = _dbt_cloud_jobs_api(runs_by_job=runs_by_job, artifacts_by_run=artifacts_by_run)
        _serve(tracked_rest, get)

        with pytest.raises(DBTConfigException):
            list(get_dbt_details(_cloud_config(job_ids="70,71")))

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_no_job_with_a_completed_run_fails(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(runs_by_job={})
        _serve(tracked_rest, get)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_cloud_config(job_ids="70,71")))

        assert "no completed dbt runs found for any of the dbt cloud jobs" in str(exc_info.value).lower()

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_catalogs_of_an_environment_are_unioned_first_entry_wins(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={"70": {"id": 1}, "71": {"id": 2}},
            artifacts_by_run={
                1: {"manifest": {"nodes": {}}, "catalog": {"nodes": {"model.p.a": {"v": 1}}, "sources": {}}},
                2: {
                    "manifest": {"nodes": {}},
                    "catalog": {"nodes": {"model.p.a": {"v": 2}, "model.p.b": {"v": 2}}, "sources": {"source.p.s": {}}},
                },
            },
        )
        _serve(tracked_rest, get)

        (dbt_files,) = get_dbt_details(_cloud_config(job_ids="70,71"))

        assert dbt_files.dbt_catalog == {
            "nodes": {"model.p.a": {"v": 1}, "model.p.b": {"v": 2}},
            "sources": {"source.p.s": {}},
        }

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_newest_run_wins_when_two_jobs_compiled_the_same_model(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={
                "70": {"id": 1, "finished_at": "2026-04-01 02:00:00.000000+00:00"},
                "71": {"id": 2, "finished_at": "2026-10-28 02:00:00.000000+00:00"},
            },
            artifacts_by_run={
                1: {"manifest": {"nodes": {"model.p.orders": _model("orders_old")}}},
                2: {"manifest": {"nodes": {"model.p.orders": _model("orders_new")}}},
            },
        )
        _serve(tracked_rest, get)

        (dbt_files,) = get_dbt_details(_cloud_config(job_ids="70,71"))

        assert dbt_files.dbt_manifest["nodes"]["model.p.orders"]["name"] == "orders_new"

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_jobs_of_one_environment_on_different_dbt_versions_fail_naming_both(self, tracked_rest):
        """A job-level dbt version override: one manifest schema cannot validate the other's nodes."""
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={"70": {"id": 1, "job_definition_id": 70}, "71": {"id": 2, "job_definition_id": 71}},
            artifacts_by_run={
                1: {"manifest": {"metadata": {"dbt_schema_version": "v12"}, "nodes": {}}},
                2: {"manifest": {"metadata": {"dbt_schema_version": "v8"}, "nodes": {}}},
            },
        )
        _serve(tracked_rest, get)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_cloud_config(job_ids="70,71")))

        message = str(exc_info.value)
        assert "[70]" in message and "[71]" in message and "v12" in message and "v8" in message

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_missing_manifest_in_a_merge_names_the_job_and_run(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(
            runs_by_job={"70": {"id": 1, "job_definition_id": 70}, "71": {"id": 2, "job_definition_id": 71}},
            artifacts_by_run={2: {"manifest": None}},
        )
        _serve(tracked_rest, get)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_cloud_config(job_ids="70,71")))

        assert "run [2] of job [71]" in str(exc_info.value)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_an_environment_is_yielded_before_the_next_is_downloaded(self, tracked_rest):
        get, requested = _dbt_cloud_jobs_api(
            runs_by_job={"70": {"id": 1, "environment_id": 5}, "71": {"id": 2, "environment_id": 6}}
        )
        _serve(tracked_rest, get)

        next(get_dbt_details(_cloud_config(job_ids="70,71")))

        assert not any("/runs/2/" in path for path, _ in requested)

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_auth_error_on_a_job_is_not_skipped(self, tracked_rest):
        tracked_rest.return_value.get.side_effect = APIError({"code": 401, "message": "unauthorized"})

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_cloud_config(job_ids="70,71")))

        assert "auth token" in str(exc_info.value).lower()
        assert tracked_rest.return_value.get.call_count == 1

    @patch("metadata.ingestion.connections.source_api_client.TrackedREST")
    def test_default_path_keeps_its_missing_manifest_message(self, tracked_rest):
        get, _ = _dbt_cloud_jobs_api(runs_by_job={None: {"id": 1}}, artifacts_by_run={1: {"manifest": None}})
        _serve(tracked_rest, get)

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_cloud_config()))

        assert str(exc_info.value) == (
            "Manifest file not found in dbt Cloud. Please ensure your dbt job generates artifacts."
        )


class TestDbtCloudRateLimit:
    @patch("metadata.ingestion.ometa.client.time.sleep")
    @patch.object(requests.Session, "request")
    def test_429_is_retried_rather_than_failing_the_run(self, session_request, _sleep):
        """Drives the real REST client: by default it turns a 429 into a final LimitsException."""

        def respond(method, url, **kwargs):
            response = requests.Response()
            response.url = str(url)
            if url.endswith("/runs") and session_request.call_count == 1:
                response.status_code = 429
                response._content = b'{"status": {"code": 429}}'
            elif url.endswith("/runs"):
                response.status_code = 200
                run = {"id": 1, "finished_at_humanized": "now", "duration_humanized": "1m"}
                response._content = json.dumps({"data": [run]}).encode()
            elif url.endswith("manifest.json"):
                response.status_code = 200
                response._content = b'{"nodes": {}}'
            else:
                response.status_code = 404
                response._content = b'{"status": {"code": 404}}'
            return response

        session_request.side_effect = respond

        (dbt_files,) = get_dbt_details(_dbt_cloud_config())

        assert dbt_files.dbt_manifest == {"nodes": {}}


def _s3_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtS3Config handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtS3Config
    config.dbtPrefixConfig.dbtBucketName = "my-bucket"
    config.dbtPrefixConfig.dbtObjectPrefix = "dbt/"
    return config


def _client_error(code):
    return ClientError({"Error": {"Code": code, "Message": code}}, "ListObjectsV2")


class TestS3ErrorClassification:
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_missing_credentials_reports_auth_failure(self, aws_client):
        aws_client.return_value.get_client.side_effect = NoCredentialsError()

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "authentication failed" in str(exc_info.value).lower()

    @pytest.mark.parametrize(
        ("error_code", "message"),
        [
            (
                "InvalidAccessKeyId",
                "The AWS Access Key Id you provided does not exist in our records.",
            ),
            (
                "SignatureDoesNotMatch",
                "The request signature we calculated does not match the signature you provided. "
                "Check your key and signing method.",
            ),
        ],
    )
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_bad_key_client_error_reports_auth_failure(self, aws_client, error_code, message):
        """These AWS codes render no 'credentials'/'accessdenied' text into str(exc), so the
        substring matcher this replaced misreported them as a generic client-init failure."""
        aws_client.return_value.get_client.side_effect = ClientError(
            {"Error": {"Code": error_code, "Message": message}}, "ListBuckets"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "authentication failed" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_no_such_bucket_reports_bucket_name(self, aws_client):
        """Raised from the boto3 paginator, the way a real bucket typo surfaces.

        metadata.utils.s3_utils.list_s3_objects swallows every exception and only logs, so
        going through it here would prove nothing about this classification."""
        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _client_error(
            "NoSuchBucket"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "my-bucket" in str(exc_info.value)
        assert "not found" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_access_denied_reports_iam_permissions(self, aws_client):
        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _client_error(
            "AccessDenied"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "permission" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AWSClient")
    def test_listing_error_raised_mid_pagination_is_still_classified(self, aws_client):
        """The paginator yields lazily, so the error can arrive after the first page has
        already been consumed by the grouping generator."""

        def _pages(**_):
            yield {"Contents": [{"Key": "dbt/manifest.json"}]}
            raise _client_error("AccessDenied")

        aws_client.return_value.get_client.return_value.get_paginator.return_value.paginate.side_effect = _pages

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_s3_config()))

        assert "permission" in str(exc_info.value).lower()


def _azure_config():
    config = MagicMock()
    # singledispatch dispatches on args[0].__class__, so this is what routes the mock to the
    # DbtAzureConfig handler; spec= cannot be used because pydantic v2 does not expose model
    # field names via dir() on the class, which would block attribute mocking below.
    config.__class__ = DbtAzureConfig
    config.dbtPrefixConfig.dbtBucketName = "my-container"
    config.dbtPrefixConfig.dbtObjectPrefix = "dbt/"
    return config


class TestAzureErrorClassification:
    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_missing_container_reports_container_name(self, azure_client):
        from azure.core.exceptions import ResourceNotFoundError

        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = ResourceNotFoundError(
            "container not found"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "my-container" in str(exc_info.value)
        assert "not found" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_auth_error_reports_permissions(self, azure_client):
        from azure.core.exceptions import ClientAuthenticationError

        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = ClientAuthenticationError(
            "forbidden"
        )

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "permission" in str(exc_info.value).lower()

    @patch("metadata.ingestion.source.database.dbt.dbt_config.AzureClient")
    def test_disabled_account_http_error_reports_permissions(self, azure_client):
        """A 403 HttpResponseError whose message never says 'forbidden' or 'authorization' —
        the substring matcher this replaced fell through to the generic 'Failed to access
        Azure container' message for this case instead of the permissions message."""
        from azure.core.exceptions import HttpResponseError

        exc = HttpResponseError("The specified account is disabled.")
        exc.status_code = 403
        blob_client = azure_client.return_value.create_blob_client.return_value
        blob_client.get_container_client.return_value.get_container_properties.side_effect = exc

        with pytest.raises(DBTConfigException) as exc_info:
            list(get_dbt_details(_azure_config()))

        assert "permission" in str(exc_info.value).lower()
