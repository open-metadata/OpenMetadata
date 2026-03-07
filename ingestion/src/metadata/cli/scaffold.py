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
Interactive scaffold for creating new OpenMetadata connectors.

Run via: metadata scaffold-connector
Or non-interactively: metadata scaffold-connector --name my_db --service-type database ...

Generates all boilerplate files AND a CONNECTOR_CONTEXT.md that gives
AI agents (Claude, Codex, Cursor, Copilot) full context to implement
the connector logic in one shot.
"""
import json
import re
import sys
from pathlib import Path
from typing import Optional

from metadata.utils.logger import cli_logger

logger = cli_logger()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COPYRIGHT_HEADER = """#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License."""

SERVICE_TYPES = [
    "database",
    "dashboard",
    "pipeline",
    "messaging",
    "mlmodel",
    "storage",
    "search",
    "api",
]

CONNECTION_TYPES = ["sqlalchemy", "rest_api", "sdk_client"]

CAPABILITY_CHOICES = [
    "metadata",
    "lineage",
    "usage",
    "profiler",
    "stored_procedures",
    "data_diff",
]

REFERENCE_CONNECTORS = {
    "database": "mysql",
    "dashboard": "metabase",
    "pipeline": "airflow",
    "messaging": "kafka",
    "mlmodel": "mlflow",
    "storage": "s3",
    "search": "elasticsearch",
    "api": "rest",
}

BASE_CLASS_MAP = {
    "database": (
        "CommonDbSourceService",
        "metadata.ingestion.source.database.common_db_source",
    ),
    "dashboard": (
        "DashboardServiceSource",
        "metadata.ingestion.source.dashboard.dashboard_service",
    ),
    "pipeline": (
        "PipelineServiceSource",
        "metadata.ingestion.source.pipeline.pipeline_service",
    ),
    "messaging": (
        "MessagingServiceSource",
        "metadata.ingestion.source.messaging.messaging_service",
    ),
    "mlmodel": (
        "MlModelServiceSource",
        "metadata.ingestion.source.mlmodel.mlmodel_service",
    ),
    "storage": (
        "StorageServiceSource",
        "metadata.ingestion.source.storage.storage_service",
    ),
    "search": (
        "SearchServiceSource",
        "metadata.ingestion.source.search.search_service",
    ),
    "api": (
        "ApiServiceSource",
        "metadata.ingestion.source.api.api_service",
    ),
}


# ---------------------------------------------------------------------------
# ConnectorProfile — the collected answers
# ---------------------------------------------------------------------------


class ConnectorProfile:
    def __init__(self):
        self.name: str = ""
        self.display_name: str = ""
        self.service_type: str = ""
        self.connection_type: str = "rest_api"
        self.scheme: Optional[str] = None
        self.default_port: Optional[int] = None
        self.auth_types: list[str] = ["basic"]
        self.capabilities: list[str] = ["metadata"]
        self.description: str = ""
        self.docs_url: str = ""
        self.docs_notes: str = ""
        self.sdk_package: str = ""
        self.api_endpoints: str = ""

    @property
    def camel(self) -> str:
        return "".join(word.capitalize() for word in self.name.split("_"))

    @property
    def module_name(self) -> str:
        return self.name.replace("_", "")


# ---------------------------------------------------------------------------
# Interactive prompts
# ---------------------------------------------------------------------------


def _prompt(label: str, default: str = "", choices: Optional[list[str]] = None) -> str:
    if choices:
        options = ", ".join(choices)
        suffix = f" [{options}]"
    else:
        suffix = ""
    if default:
        suffix += f" (default: {default})"
    suffix += ": "

    while True:
        value = input(f"  {label}{suffix}").strip()
        if not value and default:
            return default
        if choices and value not in choices:
            print(f"    Invalid choice. Must be one of: {', '.join(choices)}")
            continue
        if value:
            return value
        print("    This field is required.")


def _prompt_multi(
    label: str, choices: list[str], defaults: Optional[list[str]] = None
) -> list[str]:
    default_str = ",".join(defaults) if defaults else ""
    suffix = f" [{', '.join(choices)}]"
    if default_str:
        suffix += f" (default: {default_str})"
    suffix += ": "

    while True:
        value = input(f"  {label}{suffix}").strip()
        if not value and defaults:
            return defaults
        if not value:
            print("    At least one value is required.")
            continue
        parts = [v.strip() for v in value.replace(" ", ",").split(",") if v.strip()]
        invalid = [p for p in parts if p not in choices]
        if invalid:
            print(
                f"    Invalid: {', '.join(invalid)}. Must be from: {', '.join(choices)}"
            )
            continue
        return parts


def _prompt_optional(label: str, hint: str = "") -> str:
    suffix = f" ({hint})" if hint else ""
    suffix += " [press Enter to skip]: "
    return input(f"  {label}{suffix}").strip()


def _prompt_multiline(label: str, hint: str = "") -> str:
    print(f"  {label}" + (f" ({hint})" if hint else ""))
    print("  Enter text below. Type a blank line to finish:")
    lines = []
    while True:
        line = input("  > ")
        if not line:
            break
        lines.append(line)
    return "\n".join(lines)


def collect_interactive() -> ConnectorProfile:
    profile = ConnectorProfile()

    print()
    print("=" * 60)
    print("  OpenMetadata Connector Scaffold")
    print("=" * 60)
    print()
    print("  This will guide you through creating a new connector.")
    print("  Generated files include boilerplate code, JSON schemas,")
    print("  tests, and a CONNECTOR_CONTEXT.md for AI agents.")
    print()

    # --- Basic info ---
    print("--- Basic Info ---")
    profile.name = _prompt("Connector name (snake_case, e.g. 'my_db')")
    while not re.match(r"^[a-z][a-z0-9_]*$", profile.name):
        print("    Must be snake_case: lowercase letters, numbers, underscores.")
        profile.name = _prompt("Connector name")

    profile.display_name = _prompt("Display name", default=profile.camel)
    profile.description = _prompt_optional(
        "Short description", "e.g. 'Cloud-native OLAP database'"
    )
    print()

    # --- Classification ---
    print("--- Service Type ---")
    for i, st in enumerate(SERVICE_TYPES, 1):
        ref = REFERENCE_CONNECTORS.get(st, "")
        print(f"    {i}. {st:<12} (like {ref})")
    profile.service_type = _prompt("Service type", choices=SERVICE_TYPES)
    print()

    # --- Connection type (database only) ---
    if profile.service_type == "database":
        print("--- Connection Type ---")
        print("    sqlalchemy  — Uses SQLAlchemy engine (most common for SQL DBs)")
        print("    rest_api    — Uses REST API client")
        print("    sdk_client  — Uses vendor SDK")
        profile.connection_type = _prompt(
            "Connection type", default="sqlalchemy", choices=CONNECTION_TYPES
        )
        if profile.connection_type == "sqlalchemy":
            profile.scheme = _prompt_optional(
                "SQLAlchemy scheme", "e.g. 'mysql+pymysql', 'postgresql+psycopg2'"
            )
            port = _prompt_optional("Default port", "e.g. 3306, 5432")
            if port:
                profile.default_port = int(port)
        print()
    else:
        profile.connection_type = "rest_api"

    # --- Auth ---
    print("--- Authentication ---")
    print("    Available: basic, iam, azure, jwt, token, oauth")
    profile.auth_types = _prompt_multi(
        "Auth types", ["basic", "iam", "azure", "jwt", "token", "oauth"], ["basic"]
    )
    print()

    # --- Capabilities ---
    print("--- Capabilities ---")
    if profile.service_type == "database":
        print(
            "    Available: metadata, lineage, usage, profiler, stored_procedures, data_diff"
        )
        profile.capabilities = _prompt_multi(
            "Capabilities",
            CAPABILITY_CHOICES,
            ["metadata"],
        )
    else:
        profile.capabilities = ["metadata"]
        print("    Default: metadata (non-database connectors)")
    print()

    # --- Documentation & API info (for AI context) ---
    print("--- Source Documentation (for AI context generation) ---")
    print("  This info helps AI agents implement the connector logic.")
    print()

    profile.docs_url = _prompt_optional(
        "API/SDK documentation URL", "e.g. https://docs.example.com/api"
    )
    profile.sdk_package = _prompt_optional(
        "Python SDK package", "e.g. 'boto3', 'looker-sdk', PyPI name"
    )
    profile.api_endpoints = _prompt_optional(
        "Key API endpoints", "e.g. 'GET /api/v1/databases, GET /api/v1/tables'"
    )
    profile.docs_notes = _prompt_multiline(
        "Any additional notes about the source?",
        "auth quirks, pagination, rate limits, special types, etc.",
    )
    print()

    return profile


# ---------------------------------------------------------------------------
# Naming helpers
# ---------------------------------------------------------------------------


def to_camel_case(name: str) -> str:
    return "".join(word.capitalize() for word in name.split("_"))


# ---------------------------------------------------------------------------
# File generators — JSON schemas
# ---------------------------------------------------------------------------


def _build_auth_refs(auth_types: list[str]) -> list[dict]:
    refs = []
    if "basic" in auth_types:
        refs.append({"$ref": "./common/basicAuth.json"})
    if "iam" in auth_types:
        refs.append({"$ref": "./common/iamAuthConfig.json"})
    if "azure" in auth_types:
        refs.append({"$ref": "./common/azureConfig.json"})
    if "jwt" in auth_types:
        refs.append({"$ref": "./common/jwtAuth.json"})
    return refs


def generate_connection_schema(p: ConnectorProfile) -> dict:
    camel = p.camel
    type_def_name = f"{p.module_name}Type"
    title = f"{camel}Connection"

    schema: dict = {
        "$id": f"https://open-metadata.org/schema/entity/services/connections/{p.service_type}/{p.module_name}Connection.json",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": title,
        "description": p.description or f"{camel} Connection Config",
        "type": "object",
        "javaType": f"org.openmetadata.schema.services.connections.{p.service_type}.{title}",
        "definitions": {
            type_def_name: {
                "description": "Service type.",
                "type": "string",
                "enum": [camel],
                "default": camel,
            }
        },
        "properties": {
            "type": {
                "title": "Service Type",
                "description": "Service Type",
                "$ref": f"#/definitions/{type_def_name}",
                "default": camel,
            }
        },
        "additionalProperties": False,
        "required": [],
    }

    props = schema["properties"]
    required = schema["required"]

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        scheme_def = f"{p.module_name}Scheme"
        scheme_val = p.scheme or f"{p.name}+py{p.name}"
        schema["definitions"][scheme_def] = {
            "description": "SQLAlchemy driver scheme options.",
            "type": "string",
            "enum": [scheme_val],
            "default": scheme_val,
        }
        props["scheme"] = {
            "title": "Connection Scheme",
            "description": "SQLAlchemy driver scheme options.",
            "$ref": f"#/definitions/{scheme_def}",
            "default": scheme_val,
        }
        props["username"] = {
            "title": "Username",
            "description": f"Username to connect to {camel}.",
            "type": "string",
        }
        required.append("username")
        auth_refs = _build_auth_refs(p.auth_types)
        if auth_refs:
            props["authType"] = {
                "title": "Auth Configuration Type",
                "description": "Choose Auth Config Type.",
                "mask": True,
                "oneOf": auth_refs,
            }
        props["hostPort"] = {
            "title": "Host and Port",
            "description": f"Host and port of the {camel} service.",
            "type": "string",
        }
        required.append("hostPort")
        props["databaseName"] = {
            "title": "Database Name",
            "description": "Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.",
            "type": "string",
        }
        props["databaseSchema"] = {
            "title": "Database Schema",
            "description": "Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema.",
            "type": "string",
        }
        props["sslConfig"] = {
            "title": "SSL",
            "description": "SSL Configuration details.",
            "$ref": "../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig",
        }
        props["connectionOptions"] = {
            "title": "Connection Options",
            "$ref": "../connectionBasicType.json#/definitions/connectionOptions",
        }
        props["connectionArguments"] = {
            "title": "Connection Arguments",
            "$ref": "../connectionBasicType.json#/definitions/connectionArguments",
        }
        for pat, title_str in [
            ("schemaFilterPattern", "Default Schema Filter Pattern"),
            ("tableFilterPattern", "Default Table Filter Pattern"),
            ("databaseFilterPattern", "Default Database Filter Pattern"),
        ]:
            props[pat] = {
                "title": title_str,
                "description": f"Regex to only include/exclude {pat.replace('FilterPattern', '').lower()}s that matches the pattern.",
                "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern",
            }
        props["supportsMetadataExtraction"] = {
            "title": "Supports Metadata Extraction",
            "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction",
        }
        props["supportsDBTExtraction"] = {
            "$ref": "../connectionBasicType.json#/definitions/supportsDBTExtraction"
        }
        if "profiler" in p.capabilities:
            props["supportsProfiler"] = {
                "title": "Supports Profiler",
                "$ref": "../connectionBasicType.json#/definitions/supportsProfiler",
            }
            props["supportsQueryComment"] = {
                "title": "Supports Query Comment",
                "$ref": "../connectionBasicType.json#/definitions/supportsQueryComment",
            }
        if "data_diff" in p.capabilities:
            props["supportsDataDiff"] = {
                "title": "Supports Data Diff Extraction.",
                "$ref": "../connectionBasicType.json#/definitions/supportsDataDiff",
            }
        if "usage" in p.capabilities:
            props["supportsUsageExtraction"] = {
                "$ref": "../connectionBasicType.json#/definitions/supportsUsageExtraction"
            }
        if "lineage" in p.capabilities:
            props["supportsLineageExtraction"] = {
                "$ref": "../connectionBasicType.json#/definitions/supportsLineageExtraction"
            }

    elif p.service_type == "dashboard":
        props["hostPort"] = {
            "expose": True,
            "title": "Host and Port",
            "description": f"Host and Port of the {camel} instance.",
            "type": "string",
            "format": "uri",
        }
        required.append("hostPort")
        if "basic" in p.auth_types:
            props["username"] = {
                "title": "Username",
                "description": f"Username to connect to {camel}.",
                "type": "string",
            }
            props["password"] = {
                "title": "Password",
                "description": f"Password to connect to {camel}.",
                "type": "string",
                "format": "password",
            }
        if "token" in p.auth_types or "oauth" in p.auth_types:
            props["token"] = {
                "title": "API Token",
                "description": f"API token to authenticate with {camel}.",
                "type": "string",
                "format": "password",
            }
        for pat, title_str in [
            ("dashboardFilterPattern", "Default Dashboard Filter Pattern"),
            ("chartFilterPattern", "Default Chart Filter Pattern"),
            ("projectFilterPattern", "Default Project Filter Pattern"),
        ]:
            props[pat] = {
                "description": f"Regex to exclude or include {pat.replace('FilterPattern', '').lower()}s that matches the pattern.",
                "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern",
                "title": title_str,
            }
        props["supportsMetadataExtraction"] = {
            "title": "Supports Metadata Extraction",
            "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction",
        }

    elif p.service_type == "pipeline":
        props["hostPort"] = {
            "expose": True,
            "title": "Host And Port",
            "description": "Pipeline Service Management/UI URI.",
            "type": "string",
            "format": "uri",
        }
        required.append("hostPort")
        if "basic" in p.auth_types:
            props["username"] = {
                "title": "Username",
                "description": f"Username to connect to {camel}.",
                "type": "string",
            }
            props["password"] = {
                "title": "Password",
                "description": f"Password to connect to {camel}.",
                "type": "string",
                "format": "password",
            }
        if "token" in p.auth_types or "oauth" in p.auth_types:
            props["token"] = {
                "title": "API Token",
                "description": f"API token to authenticate with {camel}.",
                "type": "string",
                "format": "password",
            }
        props["pipelineFilterPattern"] = {
            "description": "Regex exclude pipelines.",
            "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern",
            "title": "Default Pipeline Filter Pattern",
        }
        props["supportsMetadataExtraction"] = {
            "title": "Supports Metadata Extraction",
            "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction",
        }

    elif p.service_type == "messaging":
        props["bootstrapServers"] = {
            "title": "Bootstrap Servers",
            "description": f"Bootstrap servers for {camel}. Comma separated: host1:9092,host2:9092",
            "type": "string",
        }
        required.append("bootstrapServers")
        if "basic" in p.auth_types:
            props["username"] = {
                "title": "Username",
                "description": f"Username to connect to {camel}.",
                "type": "string",
            }
            props["password"] = {
                "title": "Password",
                "description": f"Password to connect to {camel}.",
                "type": "string",
                "format": "password",
            }
        props["topicFilterPattern"] = {
            "description": "Regex to only fetch topics that matches the pattern.",
            "$ref": "../../../../type/filterPattern.json#/definitions/filterPattern",
            "title": "Default Topic Filter Pattern",
        }
        props["supportsMetadataExtraction"] = {
            "title": "Supports Metadata Extraction",
            "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction",
        }

    else:
        # mlmodel, storage, search, api — all use hostPort
        props["hostPort"] = {
            "expose": True,
            "title": "Host and Port",
            "description": f"Host and Port of the {camel} instance.",
            "type": "string",
            "format": "uri",
        }
        required.append("hostPort")
        if "basic" in p.auth_types:
            props["username"] = {
                "title": "Username",
                "description": f"Username to connect to {camel}.",
                "type": "string",
            }
            props["password"] = {
                "title": "Password",
                "description": f"Password to connect to {camel}.",
                "type": "string",
                "format": "password",
            }
        if "token" in p.auth_types or "oauth" in p.auth_types:
            props["token"] = {
                "title": "API Token",
                "description": f"API token to authenticate with {camel}.",
                "type": "string",
                "format": "password",
            }
        props["supportsMetadataExtraction"] = {
            "title": "Supports Metadata Extraction",
            "$ref": "../connectionBasicType.json#/definitions/supportsMetadataExtraction",
        }

    return schema


def generate_test_connection_json(p: ConnectorProfile) -> dict:
    camel = p.camel
    steps = [
        {
            "name": "CheckAccess",
            "description": "Validate that we can properly reach the service and authenticate with the given credentials.",
            "errorMessage": f"Failed to connect to {camel}, please validate the credentials",
            "shortCircuit": True,
            "mandatory": True,
        }
    ]

    extra_steps = {
        "database": [
            ("GetSchemas", "List all the schemas available to the user.", True),
            (
                "GetTables",
                "From a given schema, list the tables belonging to that schema.",
                True,
            ),
            (
                "GetViews",
                "From a given schema, list the views belonging to that schema.",
                False,
            ),
        ],
        "dashboard": [
            ("GetDashboards", "List all dashboards available to the user.", True),
            ("GetCharts", "List charts from dashboards.", False),
        ],
        "pipeline": [
            ("GetPipelines", "List all pipelines available to the user.", True),
            (
                "GetPipelineStatus",
                "Check if pipeline execution status can be fetched.",
                False,
            ),
        ],
        "messaging": [
            ("GetTopics", "List all topics available to the user.", True),
        ],
        "mlmodel": [
            ("GetModels", "List all ML models available.", True),
        ],
        "storage": [
            ("GetContainers", "List all containers/buckets available.", True),
        ],
        "search": [
            ("GetSearchIndexes", "List all search indexes available.", True),
        ],
        "api": [
            ("GetCollections", "List all API collections available.", True),
        ],
    }

    for step_name, desc, mandatory in extra_steps.get(p.service_type, []):
        steps.append(
            {
                "name": step_name,
                "description": desc,
                "errorMessage": f"Failed to {desc.lower().rstrip('.')}.",
                "mandatory": mandatory,
            }
        )

    if p.service_type == "database" and (
        "usage" in p.capabilities or "lineage" in p.capabilities
    ):
        steps.append(
            {
                "name": "GetQueries",
                "description": "Check if we can access query logs for usage and lineage analysis.",
                "errorMessage": "Failed to fetch queries.",
                "mandatory": False,
            }
        )

    return {
        "name": camel,
        "displayName": f"{camel} Test Connection",
        "description": f"This Test Connection validates the access against the {camel} service and basic metadata extraction.",
        "steps": steps,
    }


# ---------------------------------------------------------------------------
# File generators — Python source
# ---------------------------------------------------------------------------


def gen_init_py() -> str:
    return ""


def gen_connection_database_sqlalchemy(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
Source connection handler
"""
from typing import Optional

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.{p.module_name}Connection import (
    {camel}Connection as {camel}ConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


class {camel}Connection(BaseConnection[{camel}ConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        # TODO: Implement connection logic. If the source uses standard
        # host/port/user/password, this default works. Otherwise customize.
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )

    def get_connection_dict(self) -> dict:
        raise NotImplementedError(
            "get_connection_dict is not implemented for {camel}"
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
'''


def gen_connection_non_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
Source connection handler
"""
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.{p.service_type}.{p.name}.client import {camel}Client
from metadata.utils.constants import THREE_MIN


def get_connection(connection: {camel}Connection) -> {camel}Client:
    return {camel}Client(connection)


def test_connection(
    metadata: OpenMetadata,
    client: {camel}Client,
    service_connection: {camel}Connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    # TODO: Map test step names to callable functions.
    # These names must match the steps in testConnections/{p.service_type}/{p.module_name}.json
    test_fn = {{
        "CheckAccess": client.test_access,
    }}

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
'''


def gen_metadata_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} source module
"""
from typing import Optional, cast

from metadata.generated.schema.entity.services.connections.database.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


class {camel}Source(CommonDbSourceService):
    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = cast({camel}Connection, config.serviceConnection.root.config)
        if not isinstance(connection, {camel}Connection):
            raise InvalidSourceException(
                f"Expected {camel}Connection, but got {{connection}}"
            )
        return cls(config, metadata)
'''


def gen_metadata_non_database(p: ConnectorProfile) -> str:
    camel = p.camel
    base_class, base_module = BASE_CLASS_MAP[p.service_type]
    return f'''{COPYRIGHT_HEADER}
"""
{camel} source module
"""
from typing import Optional

from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.{p.service_type}.{p.name}.connection import get_connection
from {base_module} import {base_class}


class {camel}Source({base_class}):
    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: {camel}Connection = config.serviceConnection.root.config
        if not isinstance(connection, {camel}Connection):
            raise InvalidSourceException(
                f"Expected {camel}Connection, but got {{connection}}"
            )
        return cls(config, metadata)
'''


def gen_service_spec_database(p: ConnectorProfile) -> str:
    camel = p.camel
    imports = [
        f"from metadata.ingestion.source.database.{p.name}.metadata import {camel}Source",
    ]
    spec_args = [f"    metadata_source_class={camel}Source,"]

    if "lineage" in p.capabilities:
        imports.append(
            f"from metadata.ingestion.source.database.{p.name}.lineage import {camel}LineageSource"
        )
        spec_args.append(f"    lineage_source_class={camel}LineageSource,")
    if "usage" in p.capabilities:
        imports.append(
            f"from metadata.ingestion.source.database.{p.name}.usage import {camel}UsageSource"
        )
        spec_args.append(f"    usage_source_class={camel}UsageSource,")

    imports.append(
        f"from metadata.ingestion.source.database.{p.name}.connection import {camel}Connection"
    )
    spec_args.append(f"    connection_class={camel}Connection,")
    imports.append(
        "from metadata.utils.service_spec.default import DefaultDatabaseSpec"
    )

    return (
        "\n".join(imports)
        + "\n\nServiceSpec = DefaultDatabaseSpec(\n"
        + "\n".join(spec_args)
        + "\n)\n"
    )


def gen_service_spec_non_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f"""from metadata.ingestion.source.{p.service_type}.{p.name}.metadata import {camel}Source
from metadata.utils.service_spec import BaseSpec

ServiceSpec = BaseSpec(metadata_source_class={camel}Source)
"""


def gen_queries_database(p: ConnectorProfile) -> str:
    camel = p.camel
    upper = p.name.upper()
    return f'''{COPYRIGHT_HEADER}
"""
{camel} SQL Queries
"""
import textwrap

# TODO: Add SQL queries for extracting metadata, usage logs, etc.
{upper}_TEST_GET_QUERIES = textwrap.dedent(
    """
    SELECT 1
    """
)
'''


def gen_lineage_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} lineage module
"""
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.{p.name}.query_parser import {camel}QueryParserSource


class {camel}LineageSource({camel}QueryParserSource, LineageSource):
    # TODO: Add SQL filters to identify lineage-relevant queries
    # e.g. CREATE TABLE AS SELECT, INSERT INTO ... SELECT, MERGE
    filters = ""
'''


def gen_usage_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} usage module
"""
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.ingestion.source.database.{p.name}.query_parser import {camel}QueryParserSource


class {camel}UsageSource({camel}QueryParserSource, UsageSource):
    filters = ""
'''


def gen_query_parser_database(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} query parser module
"""
from abc import ABC
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource


class {camel}QueryParserSource(QueryParserSource, ABC):
    filters: str

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: {camel}Connection = config.serviceConnection.root.config
        if not isinstance(connection, {camel}Connection):
            raise InvalidSourceException(
                f"Expected {camel}Connection, but got {{connection}}"
            )
        return cls(config, metadata)
'''


def gen_client_non_database(p: ConnectorProfile) -> str:
    camel = p.camel
    sdk_hint = ""
    if p.sdk_package:
        sdk_hint = f"\n# SDK package: {p.sdk_package}"
    return f'''{COPYRIGHT_HEADER}
"""
{camel} REST client
"""{sdk_hint}
from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class {camel}Client:
    def __init__(self, config: {camel}Connection):
        self.config = config
        # TODO: Initialize your REST/SDK client here
        # e.g. self.session = requests.Session()
        # self.session.headers["Authorization"] = f"Bearer {{config.token}}"

    def test_access(self):
        """Validate that the service is accessible."""
        # TODO: Make a lightweight API call to verify credentials
        raise NotImplementedError("Implement test_access")
'''


# ---------------------------------------------------------------------------
# Test file generators
# ---------------------------------------------------------------------------


def gen_unit_test(p: ConnectorProfile) -> str:
    camel = p.camel
    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} source
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.ingestion.source.database.{p.name}.metadata import {camel}Source


class Test{camel}Source(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def test_create(self, mock_test_connection):
        mock_test_connection.return_value = True
        config = {{
            "source": {{
                "type": "{p.name.replace('_', '-')}",
                "serviceName": "test_{p.name}",
                "serviceConnection": {{
                    "config": {{
                        "type": "{camel}",
                        "hostPort": "localhost:5432",
                        "username": "test_user",
                        "authType": {{
                            "password": "test_password"
                        }},
                    }}
                }},
                "sourceConfig": {{
                    "config": {{
                        "type": "DatabaseMetadata"
                    }}
                }},
            }},
            "sink": {{
                "type": "metadata-rest",
                "config": {{}},
            }},
            "workflowConfig": {{
                "loggerLevel": "DEBUG",
                "openMetadataServerConfig": {{
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {{
                        "jwtToken": "token"
                    }},
                }},
            }},
        }}
        # TODO: Validate source creation
        # source = {camel}Source.create(config["source"], metadata)
'''
    else:
        return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} source
"""
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)


class Test{camel}Source(TestCase):
    @patch(
        "metadata.ingestion.source.{p.service_type}.{p.name}.connection.get_connection"
    )
    def test_create(self, mock_get_connection):
        mock_get_connection.return_value = None
        # TODO: Add source creation and validation tests
'''


def gen_integration_conftest(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} integration test fixtures
"""
import pytest


@pytest.fixture(scope="module")
def {p.name}_service():
    """
    Set up and tear down a {camel} service for integration testing.
    TODO: Configure testcontainers or mock server.
    """
    yield None
'''


def gen_integration_test_metadata(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} integration tests
"""
import pytest


class Test{camel}Metadata:
    @pytest.mark.integration
    def test_connection(self, {p.name}_service):
        """Test that a connection can be established."""
        pass

    @pytest.mark.integration
    def test_metadata_extraction(self, {p.name}_service):
        """Test that metadata can be extracted."""
        pass
'''


def gen_integration_connection_test(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} connection integration tests
"""
import pytest

from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)


class Test{camel}Connection:
    @pytest.mark.integration
    def test_get_connection(self):
        """Test that get_connection returns a valid client."""
        pass

    @pytest.mark.integration
    def test_test_connection(self):
        """Test that test_connection succeeds against a live service."""
        pass
'''


# ---------------------------------------------------------------------------
# CONNECTOR_CONTEXT.md — the AI agent brief
# ---------------------------------------------------------------------------


def generate_connector_context(p: ConnectorProfile, root: Path) -> str:
    camel = p.camel
    ref = REFERENCE_CONNECTORS.get(p.service_type, "mysql")
    base_class, base_module = BASE_CLASS_MAP[p.service_type]

    source_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{p.name}"
    ref_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{ref}"

    sections = []
    sections.append(f"# {camel} Connector — AI Implementation Context")
    sections.append("")
    sections.append(
        "This file was generated by `metadata scaffold-connector` to give AI agents"
    )
    sections.append(
        "(Claude, Codex, Cursor, Copilot) full context to implement this connector."
    )
    sections.append("")

    sections.append("## Connector Profile")
    sections.append("")
    sections.append(f"- **Name**: {camel}")
    sections.append(f"- **Service Type**: {p.service_type}")
    sections.append(f"- **Connection Type**: {p.connection_type}")
    sections.append(f"- **Base Class**: `{base_class}` from `{base_module}`")
    sections.append(f"- **Auth Types**: {', '.join(p.auth_types)}")
    sections.append(f"- **Capabilities**: {', '.join(p.capabilities)}")
    if p.description:
        sections.append(f"- **Description**: {p.description}")
    if p.scheme:
        sections.append(f"- **SQLAlchemy Scheme**: `{p.scheme}`")
    if p.default_port:
        sections.append(f"- **Default Port**: {p.default_port}")
    if p.sdk_package:
        sections.append(f"- **Python SDK Package**: `{p.sdk_package}`")
    sections.append("")

    if p.docs_url or p.api_endpoints or p.docs_notes:
        sections.append("## Source Documentation")
        sections.append("")
        if p.docs_url:
            sections.append(f"- **API Docs**: {p.docs_url}")
        if p.sdk_package:
            sections.append(f"- **SDK**: `pip install {p.sdk_package}`")
        if p.api_endpoints:
            sections.append(f"- **Key Endpoints**: {p.api_endpoints}")
        if p.docs_notes:
            sections.append("")
            sections.append("### Notes")
            sections.append(p.docs_notes)
        sections.append("")

    sections.append("## Generated Files (implement TODO items)")
    sections.append("")
    sections.append("| File | Status | What to implement |")
    sections.append("|------|--------|-------------------|")
    sections.append(
        f"| `{source_dir}/connection.py` | Scaffold | Connection logic, auth handling |"
    )
    sections.append(
        f"| `{source_dir}/metadata.py` | Scaffold | Metadata extraction methods |"
    )
    sections.append(
        f"| `{source_dir}/service_spec.py` | Complete | No changes needed |"
    )

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        sections.append(
            f"| `{source_dir}/queries.py` | Scaffold | SQL queries for metadata/logs |"
        )
        if "lineage" in p.capabilities:
            sections.append(
                f"| `{source_dir}/lineage.py` | Scaffold | Query log filters for lineage |"
            )
            sections.append(
                f"| `{source_dir}/query_parser.py` | Scaffold | Query log SQL statement |"
            )
        if "usage" in p.capabilities:
            sections.append(
                f"| `{source_dir}/usage.py` | Scaffold | Query log filters for usage |"
            )
    else:
        sections.append(
            f"| `{source_dir}/client.py` | Scaffold | REST/SDK client methods |"
        )

    sections.append("")

    sections.append("## Reference Connector (copy patterns from here)")
    sections.append("")
    sections.append(
        f"The `{ref}` connector is the closest reference. Study these files:"
    )
    sections.append("")
    sections.append(f"- `{ref_dir}/metadata.py` — How to implement extraction methods")
    sections.append(
        f"- `{ref_dir}/connection.py` — How to handle connection + test_connection"
    )
    sections.append(f"- `{ref_dir}/service_spec.py` — ServiceSpec pattern")
    sections.append("")

    sections.append("## Architecture Pattern")
    sections.append("")
    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        sections.append("```")
        sections.append("connection.py  — BaseConnection[Config, Engine] subclass")
        sections.append("  ├── _get_client() → Engine  (SQLAlchemy engine)")
        sections.append("  └── test_connection() → TestConnectionResult")
        sections.append("")
        sections.append("metadata.py    — CommonDbSourceService subclass")
        sections.append("  └── create() classmethod validates config type")
        sections.append("")
        sections.append(
            "service_spec.py — DefaultDatabaseSpec(metadata/lineage/usage/connection)"
        )
        sections.append("```")
    else:
        sections.append("```")
        sections.append("client.py      — REST/SDK wrapper")
        sections.append("  ├── __init__(config)  — Set up HTTP session / SDK client")
        sections.append("  └── test_access()     — Lightweight validation call")
        sections.append("")
        sections.append(
            "connection.py  — get_connection() + test_connection() functions"
        )
        sections.append(
            f"metadata.py    — {base_class} subclass with extraction methods"
        )
        sections.append("service_spec.py — BaseSpec(metadata_source_class=...)")
        sections.append("```")
    sections.append("")

    sections.append("## Registration Checklist (after implementing)")
    sections.append("")
    svc_schema = f"openmetadata-spec/src/main/resources/json/schema/entity/services/{p.service_type}Service.json"
    sections.append(f"1. **Service enum**: Add `{camel}` to `{svc_schema}`")
    sections.append(
        f'   - Add to type enum and connection oneOf: `{{"$ref": "connections/{p.service_type}/{p.module_name}Connection.json"}}`'
    )

    ui_utils_map = {
        "database": "DatabaseServiceUtils.tsx",
        "dashboard": "DashboardServiceUtils.ts",
        "pipeline": "PipelineServiceUtils.ts",
        "messaging": "MessagingServiceUtils.ts",
        "mlmodel": "MlmodelServiceUtils.ts",
        "storage": "StorageServiceUtils.ts",
        "search": "SearchServiceUtils.ts",
        "api": "APIServiceUtils.ts",
    }
    ui_file = ui_utils_map.get(p.service_type, "")
    sections.append(
        f"2. **UI service utils**: `openmetadata-ui/.../utils/{ui_file}` — import schema, add switch case"
    )
    sections.append(
        "3. **i18n**: `openmetadata-ui/.../locale/languages/` — add display name keys"
    )
    sections.append(
        "4. **Code gen**: `make generate` + `mvn clean install -pl openmetadata-spec` + `yarn parse-schema`"
    )
    sections.append(
        "5. **Format**: `mvn spotless:apply` + `cd ingestion && make py_format && make lint`"
    )
    sections.append("")

    sections.append("## Validation Checklist")
    sections.append("")
    sections.append(
        "- [ ] JSON Schema validates (`$ref` resolves, `supports*` flags correct)"
    )
    sections.append("- [ ] `make generate` succeeds (Pydantic models generated)")
    sections.append(
        "- [ ] `mvn clean install -pl openmetadata-spec` succeeds (Java models)"
    )
    sections.append("- [ ] `yarn parse-schema` succeeds (UI schemas)")
    sections.append("- [ ] Connection creates client successfully")
    sections.append("- [ ] `test_connection()` passes all steps")
    sections.append("- [ ] Unit tests pass")
    sections.append("- [ ] Integration tests pass")
    sections.append(
        "- [ ] `mvn spotless:apply` + `make py_format` + `make lint` all pass"
    )
    sections.append("")

    return "\n".join(sections)


# ---------------------------------------------------------------------------
# File writer
# ---------------------------------------------------------------------------


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        logger.warning(f"File already exists, skipping: {path}")
        return
    path.write_text(content)
    logger.info(
        f"  Created: {path.relative_to(Path.cwd()) if path.is_relative_to(Path.cwd()) else path}"
    )


# ---------------------------------------------------------------------------
# Main scaffold orchestrator
# ---------------------------------------------------------------------------


def get_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "openmetadata-spec").is_dir():
            return current
        current = current.parent
    logger.error("Could not find repository root")
    sys.exit(1)


def run_scaffold(profile: ConnectorProfile) -> None:
    root = get_repo_root()
    p = profile

    logger.info("")
    logger.info(f"Scaffolding {p.camel} connector...")
    logger.info(f"  Service type:    {p.service_type}")
    logger.info(f"  Connection type: {p.connection_type}")
    logger.info(f"  Capabilities:    {', '.join(p.capabilities)}")
    logger.info(f"  Auth types:      {', '.join(p.auth_types)}")
    logger.info("")

    # 1. Connection JSON Schema
    schema_dir = (
        root
        / "openmetadata-spec/src/main/resources/json/schema/entity/services/connections"
        / p.service_type
    )
    write_file(
        schema_dir / f"{p.module_name}Connection.json",
        json.dumps(generate_connection_schema(p), indent=2) + "\n",
    )

    # 2. Test Connection JSON
    test_conn_dir = (
        root
        / "openmetadata-service/src/main/resources/json/data/testConnections"
        / p.service_type
    )
    write_file(
        test_conn_dir / f"{p.module_name}.json",
        json.dumps(generate_test_connection_json(p), indent=4) + "\n",
    )

    # 3. Connector Python files
    source_dir = (
        root / "ingestion/src/metadata/ingestion/source" / p.service_type / p.name
    )
    write_file(source_dir / "__init__.py", gen_init_py())

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        write_file(source_dir / "connection.py", gen_connection_database_sqlalchemy(p))
        write_file(source_dir / "metadata.py", gen_metadata_database(p))
        write_file(source_dir / "service_spec.py", gen_service_spec_database(p))
        write_file(source_dir / "queries.py", gen_queries_database(p))
        if "lineage" in p.capabilities:
            write_file(source_dir / "lineage.py", gen_lineage_database(p))
            write_file(source_dir / "query_parser.py", gen_query_parser_database(p))
        if "usage" in p.capabilities:
            write_file(source_dir / "usage.py", gen_usage_database(p))
            if not (source_dir / "query_parser.py").exists():
                write_file(source_dir / "query_parser.py", gen_query_parser_database(p))
    else:
        write_file(source_dir / "connection.py", gen_connection_non_database(p))
        write_file(source_dir / "metadata.py", gen_metadata_non_database(p))
        write_file(source_dir / "service_spec.py", gen_service_spec_non_database(p))
        write_file(source_dir / "client.py", gen_client_non_database(p))

    # 4. Test files
    unit_test_dir = root / "ingestion/tests/unit/topology" / p.service_type
    write_file(unit_test_dir / f"test_{p.name}.py", gen_unit_test(p))

    integration_conn_dir = root / "ingestion/tests/integration/connections"
    write_file(
        integration_conn_dir / f"test_{p.name}_connection.py",
        gen_integration_connection_test(p),
    )

    integration_dir = root / "ingestion/tests/integration" / p.name
    write_file(integration_dir / "conftest.py", gen_integration_conftest(p))
    write_file(integration_dir / "test_metadata.py", gen_integration_test_metadata(p))

    # 5. CONNECTOR_CONTEXT.md — the AI brief
    context_md = generate_connector_context(p, root)
    write_file(source_dir / "CONNECTOR_CONTEXT.md", context_md)

    # 6. Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("  Scaffold complete!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("  Next steps:")
    logger.info(f"  1. Read {source_dir.relative_to(root)}/CONNECTOR_CONTEXT.md")
    logger.info("  2. Implement the TODO items in the generated files")
    logger.info("  3. Register the connector (see CONNECTOR_CONTEXT.md)")
    logger.info("  4. Run code generation + formatting")
    logger.info("")
    logger.info("  For AI-assisted implementation, point your agent at:")
    logger.info(f"    {source_dir.relative_to(root)}/CONNECTOR_CONTEXT.md")
    logger.info("")


def run_scaffold_interactive() -> None:
    profile = collect_interactive()
    run_scaffold(profile)


def run_scaffold_cli(args) -> None:
    """Entry point for non-interactive (argparse-driven) scaffold."""
    profile = ConnectorProfile()
    profile.name = args.name
    profile.service_type = args.service_type
    profile.connection_type = args.connection_type or (
        "sqlalchemy" if args.service_type == "database" else "rest_api"
    )
    profile.scheme = args.scheme
    profile.default_port = args.default_port
    profile.auth_types = args.auth_types or ["basic"]
    profile.capabilities = args.capabilities or ["metadata"]
    profile.display_name = args.display_name or profile.camel
    profile.description = args.description or ""
    profile.docs_url = args.docs_url or ""
    profile.sdk_package = args.sdk_package or ""
    profile.api_endpoints = args.api_endpoints or ""
    profile.docs_notes = args.docs_notes or ""

    if not re.match(r"^[a-z][a-z0-9_]*$", profile.name):
        logger.error("Connector name must be snake_case.")
        sys.exit(1)

    run_scaffold(profile)
