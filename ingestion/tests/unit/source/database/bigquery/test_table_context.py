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
"""BigQuery test-suite sessions must select the attached table's project."""

import pytest
from google.auth.credentials import AnonymousCredentials

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.security.credentials.gcpCredentials import GCPImpersonateServiceAccountValues
from metadata.generated.schema.security.credentials.gcpValues import SingleProjectId
from metadata.ingestion.source.database.bigquery.connection import get_connection_url
from metadata.utils.bigquery_utils import copy_service_config


@pytest.fixture(params=["service_account", "gcp_credential_path", "gcp_adc"])
def credential_config(request, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "decoy")
    config = {"type": request.param}
    if request.param == "gcp_credential_path":
        config["path"] = "/synthetic/credentials.json"
    return config


def workflow(gcp_config):
    return OpenMetadataWorkflowConfig.model_validate(
        {
            "source": {
                "type": "bigquery",
                "serviceName": "bigquery",
                "serviceConnection": {
                    "config": {
                        "type": "BigQuery",
                        "credentials": {"gcpConfig": gcp_config},
                        "billingProjectId": "billing-project",
                        "usageLocation": "eu",
                    }
                },
                "sourceConfig": {"config": {"type": "TestSuite"}},
            },
            "workflowConfig": {
                "openMetadataServerConfig": {"hostPort": "http://localhost:8585/api", "authProvider": "openmetadata"}
            },
        }
    )


@pytest.mark.parametrize("projects", [None, "target", "decoy", ["decoy", "target"], ["target", "decoy"]])
def test_copy_selects_target_project_and_preserves_original(credential_config, projects):
    config = workflow({**credential_config, "projectId": projects})
    config.source.serviceConnection.root.config.credentials.gcpImpersonateServiceAccount = (
        GCPImpersonateServiceAccountValues(impersonateServiceAccount="runner@example.com", lifetime=600)
    )
    original = config.model_dump()
    copied = copy_service_config(config, "target")
    assert isinstance(copied.credentials.gcpConfig.projectId, SingleProjectId)
    assert copied.credentials.gcpConfig.projectId.root == "target"
    assert get_connection_url(copied).host == "target"
    expected = config.source.serviceConnection.root.config.model_dump()
    expected["credentials"]["gcpConfig"]["projectId"] = "target"
    assert copied.model_dump() == expected
    copied.credentials.gcpConfig.projectId.root = "mutated-copy"
    copied.credentials.gcpImpersonateServiceAccount.lifetime = 300
    assert config.model_dump() == original


def test_copy_preserves_external_account_default():
    config = workflow({"type": "external_account", "audience": "synthetic-audience"})
    assert (
        copy_service_config(config, "target").model_dump() == config.source.serviceConnection.root.config.model_dump()
    )


def test_test_suite_session_bind_selects_target_project(credential_config, monkeypatch):
    # Stub only Google authentication; retain the real connector, dialect and session creation.
    monkeypatch.setattr("google.auth.default", lambda **_: (AnonymousCredentials(), "decoy"))
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/synthetic/credentials.json")
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", "decoy")
    config = workflow({**credential_config, "projectId": ["decoy", "target"]})
    interface = SQATestSuiteInterface.__new__(SQATestSuiteInterface)
    interface.service_connection_config = copy_service_config(config, "target")
    interface.create_session()
    engine = interface.session.get_bind()
    try:
        assert engine.url.host == "target"
        assert engine.dialect.billing_project_id == "billing-project"
    finally:
        interface.session.close()
        engine.dispose()
