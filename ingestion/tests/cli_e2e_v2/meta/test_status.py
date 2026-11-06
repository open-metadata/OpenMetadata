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
"""Status parsing must not coerce broken producer output into success."""

import pytest

from ..runtime.status import Status


@pytest.fixture
def status_payload():
    return {
        "source_type": "example",
        "ingestion_pipeline_fqn": None,
        "success": True,
        "steps": [
            {
                "name": "Example",
                "records": 2,
                "updated_records": 1,
                "warnings": 0,
                "errors": 0,
                "filtered": 0,
                "failures": None,
                "progress": None,
                "operationMetrics": None,
                "sourceTimeMs": None,
                "sinkTimeMs": None,
            }
        ],
    }


@pytest.mark.parametrize("success", ["false", "true", 0, 1, None, [], {}])
def test_success_requires_a_boolean(status_payload, success):
    status_payload["success"] = success
    with pytest.raises(ValueError, match="boolean"):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("steps", [None, {}, "", [], [None], ["source"]])
def test_steps_cannot_be_missing_empty_or_non_objects(status_payload, steps):
    status_payload["steps"] = steps
    with pytest.raises((TypeError, ValueError)):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("key", ["source_type", "success", "steps"])
def test_required_status_fields(status_payload, key):
    del status_payload[key]
    with pytest.raises(ValueError):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("key", ["name", "records", "updated_records", "warnings", "errors", "filtered", "failures"])
def test_required_step_fields(status_payload, key):
    del status_payload["steps"][0][key]
    with pytest.raises((TypeError, ValueError)):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("key", ["records", "updated_records", "warnings", "errors", "filtered"])
@pytest.mark.parametrize("value", [-1, "0", False, 1.2, None])
def test_counts_require_nonnegative_integers(status_payload, key, value):
    status_payload["steps"][0][key] = value
    with pytest.raises(ValueError, match="nonnegative integer"):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("failures", [{}, "error", [None], ["error"], [{"error": 42}]])
def test_failure_details_require_objects_and_nullable_text(status_payload, failures):
    status_payload["steps"][0]["failures"] = failures
    with pytest.raises((TypeError, ValueError)):
        Status.from_dict(status_payload)


@pytest.mark.parametrize("errors,detail_count", [(0, 1), (1, 2)])
def test_failure_details_cannot_exceed_their_step_error_count(status_payload, errors, detail_count):
    status_payload["steps"][0].update(
        errors=errors, failures=[{"name": "my_table", "error": "source failed"}] * detail_count
    )
    status_payload["steps"].append({**status_payload["steps"][0], "name": "Sink", "errors": 10, "failures": None})
    with pytest.raises(ValueError, match=r"failures.*errors"):
        Status.from_dict(status_payload)


def test_error_total_does_not_count_only_sampled_details(status_payload):
    status_payload["success"] = False
    status_payload["steps"][0].update(
        errors=12, failures=[{"name": "my_table", "error": None, "stackTrace": None}] * 10
    )
    status_payload["steps"].append(
        {
            "name": "Sink",
            "records": 0,
            "updated_records": 0,
            "warnings": 0,
            "errors": 3,
            "filtered": 0,
            "failures": None,
        }
    )
    status = Status.from_dict(status_payload)
    assert status.total_errors == 15
    assert len(status.all_failures) == 10
    assert status.step("Example").failures_truncated is True
    assert status.step("Sink").failures_truncated is True
    assert status.step("Absent") is None


@pytest.mark.parametrize("source_type", ["mysql", "mysql-lineage", "custom.module.Source", None])
def test_successful_status_retains_counts_and_source_type(status_payload, source_type):
    status_payload["source_type"] = source_type
    status = Status.from_dict(status_payload)
    assert status.success is True
    assert status.source_type == source_type
    assert status.total_errors == 0
    assert status.all_failures == []
    assert status.steps[0].records == 2
    assert status.steps[0].updated_records == 1
    assert status.steps[0].failures_truncated is False
