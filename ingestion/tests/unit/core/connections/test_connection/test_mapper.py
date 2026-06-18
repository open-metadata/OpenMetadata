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
"""Unit tests for the outcome -> step-result mapper."""

from dataclasses import dataclass

from metadata.core.connections.test_connection.mapper import StepResultBuilder
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    SkipReason,
)


@dataclass
class _Step:
    name: str
    mandatory: bool


def test_passed_sets_passed_status():
    result = StepResultBuilder.passed(_Step("GetTables", True), Evidence(), 0)
    assert result.status.value == "Passed"
    assert result.passed is True


def test_passed_maps_evidence_command_summary_and_timing():
    evidence = Evidence(summary="4 tables in schema 'sales'", command="list tables in sales")
    result = StepResultBuilder.passed(_Step("GetTables", True), evidence, 12)
    assert result.executedCommand == "list tables in sales"
    assert result.resultSummary == "4 tables in schema 'sales'"
    assert result.durationMs == 12


def test_passed_without_evidence_has_no_command():
    result = StepResultBuilder.passed(_Step("CheckAccess", True), Evidence(), 5)
    assert result.executedCommand is None
    assert result.resultSummary is None
    assert result.durationMs == 5


def test_mandatory_failure_is_failed_and_keeps_raw_error():
    result = StepResultBuilder.failed(_Step("CheckAccess", True), ValueError("boom"))
    assert result.status.value == "Failed"
    assert result.passed is False
    assert result.errorLog == "boom"


def test_non_mandatory_failure_is_warning():
    result = StepResultBuilder.failed(_Step("GetTags", False), ValueError("x"))
    assert result.status.value == "Warning"
    assert result.passed is False


def test_skipped_carries_reason():
    result = StepResultBuilder.skipped(_Step("GetTables", True), SkipReason.NotImplemented)
    assert result.status.value == "Skipped"
    assert result.skipReason.value == "NotImplemented"


def test_failed_carries_diagnosis():
    diagnosis = Diagnosis(title="Access denied", remediation="check grants", doc_url="https://d/x")
    result = StepResultBuilder.failed(_Step("CheckAccess", True), ValueError("x"), diagnosis)
    assert result.diagnosis.title == "Access denied"
    assert result.diagnosis.remediation == "check grants"
    assert result.diagnosis.docUrl == "https://d/x"


def test_failed_without_diagnosis_has_none():
    result = StepResultBuilder.failed(_Step("CheckAccess", True), ValueError("x"))
    assert result.diagnosis is None
