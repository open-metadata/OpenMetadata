"""Validate the public sample recipe, including its AI Governance graph."""

import argparse
import json
from pathlib import Path
from typing import Any

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.ai.aiApplication import AIApplication
from metadata.generated.schema.entity.ai.llmModel import LLMModel
from metadata.generated.schema.entity.ai.mcpServer import McpServer
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.llmService import LLMService
from metadata.generated.schema.entity.services.mcpService import McpService
from metadata.ingestion.ometa.utils import model_str

SAMPLE_FOLDER = Path(__file__).parent.parent / "ingestion" / "examples" / "sample_data" / "ai_governance"
ENTITY_TYPES = {
    "llmModel": LLMModel,
    "mcpServer": McpServer,
    "aiApplication": AIApplication,
}
TRACKED_AI_TYPES = {
    AIApplication,
    LLMModel,
    LLMService,
    McpServer,
    McpService,
}
ENTITY_IDS: dict[str, str] = {}

metadata = int_admin_ometa()
parser = argparse.ArgumentParser()
parser.add_argument(
    "--id-snapshot",
    type=Path,
    help="Write IDs on the first run and require the same IDs on the next run.",
)
args = parser.parse_args()


def read_fixture(filename: str) -> Any:
    with (SAMPLE_FOLDER / filename).open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


def require_entity(entity_type: type[Any], fqn: str) -> Any:
    entity = metadata.get_by_name(entity=entity_type, fqn=fqn, fields=["*"])
    if entity is None:
        raise ValueError(f"{entity_type.__name__} not found: {fqn}")
    if entity_type in TRACKED_AI_TYPES:
        ENTITY_IDS[f"{entity_type.__name__}:{fqn}"] = model_str(entity.id)
    return entity


def verify_id_snapshot(snapshot_path: Path) -> None:
    if snapshot_path.exists():
        expected_ids = json.loads(snapshot_path.read_text(encoding="utf-8"))
        if expected_ids != ENTITY_IDS:
            raise ValueError(
                f"AI entity IDs changed after rerunning sample data: expected {expected_ids}, found {ENTITY_IDS}"
            )
        return
    snapshot_path.write_text(
        json.dumps(ENTITY_IDS, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def require_single_lineage_edge(
    from_type: type[Any],
    from_entity: Any,
    to_entity: Any,
) -> None:
    lineage_graph = metadata.get_lineage_by_id(
        entity=from_type,
        entity_id=from_entity.id,
        up_depth=0,
        down_depth=1,
    )
    to_id = model_str(to_entity.id)
    matching_edges = [
        edge for edge in (lineage_graph or {}).get("downstreamEdges", []) if edge.get("toEntity") == to_id
    ]
    if len(matching_edges) != 1:
        raise ValueError(
            f"Expected one lineage edge from {model_str(from_entity.id)} to {to_id}, found {len(matching_edges)}"
        )


require_entity(Table, "sample_data.ecommerce_db.shopify.dim_address")

services = read_fixture("services.json")
models = read_fixture("llm_models.json")
servers = read_fixture("mcp_servers.json")
applications = read_fixture("applications.json")
lineage = read_fixture("lineage.json")

for service in services["llmServices"]:
    require_entity(LLMService, service["name"])
for service in services["mcpServices"]:
    require_entity(McpService, service["name"])
for model in models:
    require_entity(LLMModel, f"{model['service']}.{model['name']}")
for server in servers:
    require_entity(McpServer, f"{server['service']}.{server['name']}")
for application in applications["registered"] + applications["shadow"]:
    require_entity(AIApplication, application["name"])

for edge in lineage:
    from_entity = require_entity(
        ENTITY_TYPES[edge["fromType"]],
        edge["fromFqn"],
    )
    to_entity = require_entity(
        ENTITY_TYPES[edge["toType"]],
        edge["toFqn"],
    )
    if (
        metadata.get_lineage_edge(
            model_str(from_entity.id),
            model_str(to_entity.id),
        )
        is None
    ):
        raise ValueError(
            f"Lineage edge not found: {edge['fromType']}:{edge['fromFqn']} -> {edge['toType']}:{edge['toFqn']}"
        )
    require_single_lineage_edge(
        ENTITY_TYPES[edge["fromType"]],
        from_entity,
        to_entity,
    )

claims_copilot = require_entity(AIApplication, "claims-triage-copilot")
if (
    claims_copilot.primaryModel is None
    or claims_copilot.primaryModel.fullyQualifiedName != "ai_governance_llm.gpt_4o_claims_prod"
):
    raise ValueError("Claims copilot primary model was not resolved")
if not claims_copilot.mcpServers:
    raise ValueError("Claims copilot MCP server was not resolved")

shadow_model = require_entity(
    LLMModel,
    "ai_governance_llm.external_shadow_research_llm",
)
if shadow_model.governanceStatus.value != "Unauthorized":
    raise ValueError("External shadow model is not marked unauthorized")
if shadow_model.detection is None or not shadow_model.remediationActions:
    raise ValueError("External shadow model lost detection or remediation evidence")

for shadow_application in applications["shadow"]:
    entity = require_entity(AIApplication, shadow_application["name"])
    if (
        entity.developmentStage.value != "Unauthorized"
        or entity.governanceMetadata.registrationStatus.value != "Unregistered"
    ):
        raise ValueError(f"Shadow application is not unauthorized and unregistered: {model_str(entity.name)}")

if args.id_snapshot:
    verify_id_snapshot(args.id_snapshot)
