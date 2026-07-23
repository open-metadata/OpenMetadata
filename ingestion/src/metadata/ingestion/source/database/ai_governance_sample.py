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

"""Load the declarative AI Governance showcase through normal ingestion APIs."""

from __future__ import annotations

import json
from copy import deepcopy
from typing import TYPE_CHECKING, Any, ClassVar, TypeAlias

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
from metadata.generated.schema.entity.ai.aiApplication import AIApplication
from metadata.generated.schema.entity.ai.llmModel import LLMModel
from metadata.generated.schema.entity.ai.mcpServer import McpServer
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.step import WorkflowFatalError
from metadata.ingestion.ometa.utils import model_str

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

    from pydantic import BaseModel

    from metadata.ingestion.ometa.ometa_api import OpenMetadata

AIGovernanceRequest: TypeAlias = (
    CreateLLMServiceRequest
    | CreateMcpServiceRequest
    | CreateLLMModelRequest
    | CreateMcpServerRequest
    | CreateAIApplicationRequest
    | AddLineageRequest
)


class AIGovernanceSampleDataError(WorkflowFatalError):
    """The AI Governance fixture bundle cannot be ingested safely."""


class AIGovernanceSampleData:
    """Convert the five declarative fixture files into ordered create requests."""

    _EXPECTED_COUNTS: ClassVar[dict[str, int]] = {
        "llmServices": 1,
        "mcpServices": 1,
        "llmModels": 6,
        "mcpServers": 5,
        "registeredApplications": 4,
        "shadowApplications": 4,
        "lineage": 11,
    }
    _SERVER_OWNED_FIELDS: ClassVar[set[str]] = {
        "updatedBy",
        "updatedAt",
        "fullyQualifiedName",
    }
    _LINEAGE_ENTITY_TYPES: ClassVar[dict[str, tuple[type[BaseModel], str]]] = {
        "llmModel": (LLMModel, "llmModel"),
        "mcpServer": (McpServer, "mcpServer"),
        "aiApplication": (AIApplication, "aiApplication"),
    }

    def __init__(self, fixture_folder: Path, metadata: OpenMetadata):
        self.fixture_folder = fixture_folder
        self.metadata = metadata
        self.services = self._read_json("services.json")
        self.llm_models = self._read_json("llm_models.json")
        self.mcp_servers = self._read_json("mcp_servers.json")
        self.applications = self._read_json("applications.json")
        self.lineage = self._read_json("lineage.json")
        self._validate_contract()

    def _read_json(self, filename: str) -> Any:
        fixture_path = self.fixture_folder / filename
        if not fixture_path.is_file():
            raise AIGovernanceSampleDataError(f"Missing required AI Governance sample fixture: {fixture_path}")
        try:
            with fixture_path.open(encoding="utf-8") as fixture_file:
                return json.load(fixture_file)
        except json.JSONDecodeError as exc:
            raise AIGovernanceSampleDataError(f"Malformed AI Governance sample fixture {fixture_path}: {exc}") from exc

    def _validate_contract(self) -> None:
        counts = {
            "llmServices": len(self.services.get("llmServices", [])),
            "mcpServices": len(self.services.get("mcpServices", [])),
            "llmModels": len(self.llm_models),
            "mcpServers": len(self.mcp_servers),
            "registeredApplications": len(self.applications.get("registered", [])),
            "shadowApplications": len(self.applications.get("shadow", [])),
            "lineage": len(self.lineage),
        }
        if counts != self._EXPECTED_COUNTS:
            raise AIGovernanceSampleDataError(
                f"Unexpected AI Governance sample entity counts: expected {self._EXPECTED_COUNTS}, found {counts}"
            )

        forbidden_paths = list(
            self._find_forbidden_fields(
                {
                    "services": self.services,
                    "llmModels": self.llm_models,
                    "mcpServers": self.mcp_servers,
                    "applications": self.applications,
                    "lineage": self.lineage,
                }
            )
        )
        if forbidden_paths:
            raise AIGovernanceSampleDataError(
                "AI Governance fixtures contain server-owned fields: " + ", ".join(forbidden_paths)
            )

    def _find_forbidden_fields(
        self,
        value: Any,
        path: str = "$",
    ) -> Iterator[str]:
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}"
                is_server_id = key == "id" and ".remediationActions[" not in path
                if key in self._SERVER_OWNED_FIELDS or is_server_id:
                    yield child_path
                yield from self._find_forbidden_fields(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                yield from self._find_forbidden_fields(child, f"{path}[{index}]")

    def iter_requests(self) -> Iterator[AIGovernanceRequest]:
        """Yield dependencies before records that reference them."""

        for service in self.services["llmServices"]:
            yield CreateLLMServiceRequest.model_validate(service)
        for service in self.services["mcpServices"]:
            yield CreateMcpServiceRequest.model_validate(service)

        for model in self.llm_models:
            yield CreateLLMModelRequest.model_validate(model)
        for server in self.mcp_servers:
            yield CreateMcpServerRequest.model_validate(server)

        for application in self.applications["registered"]:
            yield self._registered_application_request(application)
        for application in self.applications["shadow"]:
            yield CreateAIApplicationRequest.model_validate(application)

        for lineage_edge in self.lineage:
            yield self._lineage_request(lineage_edge)

    def _registered_application_request(
        self,
        application: dict[str, Any],
    ) -> CreateAIApplicationRequest:
        request_data = deepcopy(application)

        primary_model = request_data.get("primaryModel")
        if primary_model:
            self._resolve_reference(LLMModel, primary_model, "llmModel")

        for configuration in request_data.get("modelConfigurations", []):
            model_fqn = configuration.pop("modelFqn", None)
            if not model_fqn:
                raise AIGovernanceSampleDataError(
                    f"Application {request_data['name']} has a model configuration without modelFqn"
                )
            configuration["model"] = self._resolve_reference(
                LLMModel,
                model_fqn,
                "llmModel",
            )

        mcp_server_fqns = request_data.pop("mcpServerFqns", [])
        if mcp_server_fqns:
            request_data["mcpServers"] = [
                self._resolve_reference(McpServer, fqn, "mcpServer") for fqn in mcp_server_fqns
            ]

        return CreateAIApplicationRequest.model_validate(request_data)

    def _lineage_request(self, edge: dict[str, Any]) -> AddLineageRequest:
        from_entity = self._resolve_lineage_reference(
            edge["fromType"],
            edge["fromFqn"],
        )
        to_entity = self._resolve_lineage_reference(
            edge["toType"],
            edge["toFqn"],
        )
        return AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=from_entity,
                toEntity=to_entity,
                lineageDetails=LineageDetails(
                    description=edge.get("description"),
                    source=Source.Manual,
                ),
            )
        )

    def _resolve_lineage_reference(
        self,
        entity_type: str,
        fqn: str,
    ) -> EntityReference:
        entity_config = self._LINEAGE_ENTITY_TYPES.get(entity_type)
        if entity_config is None:
            raise AIGovernanceSampleDataError(f"Unsupported AI Governance lineage entity type: {entity_type}")
        entity_class, reference_type = entity_config
        return self._resolve_reference(entity_class, fqn, reference_type)

    def _resolve_reference(
        self,
        entity_class: type[BaseModel],
        fqn: str,
        reference_type: str,
    ) -> EntityReference:
        entity = self.metadata.get_by_name(entity=entity_class, fqn=fqn)
        if entity is None:
            raise AIGovernanceSampleDataError(f"Cannot resolve {reference_type} dependency '{fqn}'")

        return EntityReference(
            id=entity.id,
            type=reference_type,
            name=self._model_value(getattr(entity, "name", None)),
            fullyQualifiedName=self._model_value(getattr(entity, "fullyQualifiedName", None)),
            displayName=getattr(entity, "displayName", None),
        )

    @staticmethod
    def _model_value(value: Any) -> str | None:
        return model_str(value) if value is not None else None
