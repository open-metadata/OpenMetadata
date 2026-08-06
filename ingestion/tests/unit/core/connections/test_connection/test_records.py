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
"""Unit tests for the test-connection core records."""

from metadata.core.connections.test_connection.records import Diagnosis, Evidence


def test_evidence_holds_summary_and_command():
    evidence = Evidence(summary="4 databases enumerated", command="SHOW DATABASES")
    assert evidence.summary == "4 databases enumerated"
    assert evidence.command == "SHOW DATABASES"
    assert evidence.caveat is None


def test_evidence_carries_an_optional_caveat():
    caveat = Diagnosis(title="No tables visible in schema 'app'")
    evidence = Evidence(summary="0 tables", caveat=caveat)
    assert evidence.caveat is caveat


def test_diagnosis_holds_remediation_without_doc():
    diagnosis = Diagnosis(title="Auth failed", remediation="Check credentials")
    assert diagnosis.title == "Auth failed"
    assert diagnosis.remediation == "Check credentials"
    assert diagnosis.doc_url is None
