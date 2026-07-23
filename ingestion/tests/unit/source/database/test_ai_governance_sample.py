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

"""Contract and ordering tests for the AI Governance sample bundle."""

from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest

from metadata.generated.schema.api.ai.createAIApplication import (
    CreateAIApplicationRequest,
)
from metadata.generated.schema.api.ai.createLLMModel import CreateLLMModelRequest
from metadata.generated.schema.api.ai.createMcpServer import CreateMcpServerRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createLLMService import (
    CreateLLMServiceRequest,
)
from metadata.generated.schema.api.services.createMcpService import (
    CreateMcpServiceRequest,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import Source
from metadata.ingestion.api.step import WorkflowFatalError
from metadata.ingestion.source.database.ai_governance_sample import (
    AIGovernanceSampleData,
    AIGovernanceSampleDataError,
)

FIXTURE_FOLDER = Path(__file__).parents[4] / "examples" / "sample_data" / "ai_governance"


class FakeMetadata:
    """In-memory public API boundary used to model sink completion between yields."""

    def __init__(self) -> None:
        self.entities: dict[str, SimpleNamespace] = {}

    def get_by_name(self, entity: type[Any], fqn: str) -> SimpleNamespace | None:
        return self.entities.get(fqn)

    def record_created(self, request: Any) -> None:
        fqn: str | None = None
        if isinstance(request, CreateLLMModelRequest):
            fqn = f"{request.service.root}.{request.name.root}"
        elif isinstance(request, CreateMcpServerRequest):
            fqn = f"{request.service.root}.{request.name.root}"
        elif isinstance(request, CreateAIApplicationRequest):
            fqn = request.name.root

        if fqn is not None:
            self.entities[fqn] = SimpleNamespace(
                id=Uuid(uuid4()),
                name=request.name,
                fullyQualifiedName=fqn,
                displayName=request.displayName,
            )


def load_requests(
    loader: AIGovernanceSampleData,
    metadata: FakeMetadata,
) -> list[Any]:
    requests = []
    for request in loader.iter_requests():
        requests.append(request)
        metadata.record_created(request)
    return requests


def test_fixture_bundle_emits_complete_showcase_in_dependency_order() -> None:
    metadata = FakeMetadata()
    loader = AIGovernanceSampleData(FIXTURE_FOLDER, metadata)

    requests = load_requests(loader, metadata)

    assert [type(request) for request in requests] == [
        CreateLLMServiceRequest,
        CreateMcpServiceRequest,
        *([CreateLLMModelRequest] * 6),
        *([CreateMcpServerRequest] * 5),
        *([CreateAIApplicationRequest] * 8),
        *([AddLineageRequest] * 11),
    ]

    models = {request.name.root for request in requests if isinstance(request, CreateLLMModelRequest)}
    assert models == {
        "claude_3_hr_screening",
        "external_shadow_research_llm",
        "gemini_finance_forecast",
        "gpt_4o_claims_prod",
        "mistral_support_answering",
        "text_embedding_3_large",
    }

    applications = [request for request in requests if isinstance(request, CreateAIApplicationRequest)]
    assert {application.name.root for application in applications} == {
        "claims-triage-copilot",
        "finance-forecast-agent",
        "hr-screening-assistant",
        "support-answer-assistant",
        "meeting-recap-slack",
        "notion-ai-workspace",
        "salesforce-einstein-studio",
        "zoom-ai-companion-legal",
    }


def test_registered_relationships_are_resolved_from_stable_fqns() -> None:
    metadata = FakeMetadata()
    requests = load_requests(
        AIGovernanceSampleData(FIXTURE_FOLDER, metadata),
        metadata,
    )
    claims_copilot = next(
        request
        for request in requests
        if isinstance(request, CreateAIApplicationRequest) and request.name.root == "claims-triage-copilot"
    )

    assert claims_copilot.primaryModel.root == "ai_governance_llm.gpt_4o_claims_prod"
    assert claims_copilot.modelConfigurations[0].model.fullyQualifiedName == "ai_governance_llm.gpt_4o_claims_prod"
    assert [reference.fullyQualifiedName for reference in claims_copilot.mcpServers.root] == [
        "ai_governance_mcp.customer_profile_tools"
    ]


def test_mcp_servers_keep_showcase_usage_metrics() -> None:
    metadata = FakeMetadata()
    requests = load_requests(
        AIGovernanceSampleData(FIXTURE_FOLDER, metadata),
        metadata,
    )
    mcp_servers = [
        request for request in requests if isinstance(request, CreateMcpServerRequest)
    ]

    assert all(request.usageMetrics is not None for request in mcp_servers)
    customer_profile_tools = next(
        request
        for request in mcp_servers
        if request.name.root == "customer_profile_tools"
    )
    assert customer_profile_tools.usageMetrics.totalInvocations == 42_100
    assert customer_profile_tools.usageMetrics.successRate == 0.991


def test_shadow_records_do_not_invent_model_references() -> None:
    metadata = FakeMetadata()
    requests = load_requests(
        AIGovernanceSampleData(FIXTURE_FOLDER, metadata),
        metadata,
    )
    shadow_names = {
        "meeting-recap-slack",
        "notion-ai-workspace",
        "salesforce-einstein-studio",
        "zoom-ai-companion-legal",
    }
    shadow_requests = [
        request
        for request in requests
        if isinstance(request, CreateAIApplicationRequest) and request.name.root in shadow_names
    ]

    assert all(request.modelConfigurations is None for request in shadow_requests)
    assert all(request.primaryModel is None for request in shadow_requests)
    assert all(request.developmentStage.value == "Unauthorized" for request in shadow_requests)
    assert all(request.governanceMetadata.registrationStatus.value == "Unregistered" for request in shadow_requests)


def test_lineage_is_manual_and_keeps_descriptions() -> None:
    metadata = FakeMetadata()
    requests = load_requests(
        AIGovernanceSampleData(FIXTURE_FOLDER, metadata),
        metadata,
    )
    lineage_requests = [request for request in requests if isinstance(request, AddLineageRequest)]

    assert len(lineage_requests) == 11
    assert all(request.edge.lineageDetails.source is Source.Manual for request in lineage_requests)
    assert all(request.edge.lineageDetails.description for request in lineage_requests)


def test_missing_fixture_fails_before_ingestion(tmp_path: Path) -> None:
    assert issubclass(AIGovernanceSampleDataError, WorkflowFatalError)
    with pytest.raises(
        AIGovernanceSampleDataError,
        match="Missing required AI Governance sample fixture",
    ):
        AIGovernanceSampleData(tmp_path, FakeMetadata())


def test_unresolved_dependency_fails_the_workflow() -> None:
    metadata = FakeMetadata()
    loader = AIGovernanceSampleData(FIXTURE_FOLDER, metadata)
    loader.applications["registered"][0]["mcpServerFqns"] = ["ai_governance_mcp.missing-server"]

    with pytest.raises(
        AIGovernanceSampleDataError,
        match=r"Cannot resolve mcpServer dependency 'ai_governance_mcp\.missing-server'",
    ):
        load_requests(loader, metadata)
