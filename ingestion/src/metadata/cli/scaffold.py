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
import argparse
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
        self.docker_image: str = ""
        self.docker_port: Optional[int] = None

    @property
    def camel(self) -> str:
        return "".join(word.capitalize() for word in self.name.split("_"))

    @property
    def module_name(self) -> str:
        """lowerCamelCase for schema file names (e.g. bigQuery, qlikCloud)."""
        parts = self.name.split("_")
        return parts[0] + "".join(word.capitalize() for word in parts[1:])


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
                try:
                    profile.default_port = int(port)
                except ValueError:
                    print("    Invalid port number, skipping.")
        print()
    else:
        print("--- Connection Type ---")
        print("    rest_api    — Uses REST API client (most common)")
        print("    sdk_client  — Uses vendor SDK")
        profile.connection_type = _prompt(
            "Connection type", default="rest_api", choices=["rest_api", "sdk_client"]
        )
        print()

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
        print(
            "    lineage  — Query-log-based lineage (generates lineage.py + query_parser.py)"
        )
        print("    usage    — Query-log-based usage (generates usage.py)")
        print("    profiler — Column profiling + data quality (needs SQLAlchemy)")
        profile.capabilities = _prompt_multi(
            "Capabilities",
            CAPABILITY_CHOICES,
            ["metadata"],
        )
    else:
        profile.capabilities = ["metadata"]
        print("    Default: metadata")
        print("    Note: Lineage, usage, and data models for non-database connectors")
        print(
            "    are implemented as method overrides in metadata.py (no extra files)."
        )
        print("    See CONNECTOR_CONTEXT.md for details.")
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

    # --- Docker image for integration tests ---
    print("--- Integration Tests ---")
    print("  If a Docker image is available, real integration tests will be")
    print("  generated using testcontainers to spin up the service, create")
    print("  sample data, run the ingestion workflow, and assert results.")
    print()
    profile.docker_image = _prompt_optional(
        "Docker image",
        "e.g. 'metabase/metabase:latest', 'mcr.microsoft.com/mssql/server:2022-latest'",
    )
    if profile.docker_image:
        port_str = _prompt_optional("Container port to expose", "e.g. 80, 3000, 8080")
        if port_str:
            try:
                profile.docker_port = int(port_str)
            except ValueError:
                print("    Invalid port number, skipping.")
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
    mapping = {
        "basic": "./common/basicAuth.json",
        "iam": "./common/iamAuthConfig.json",
        "azure": "./common/azureConfig.json",
        "jwt": "./common/jwtAuth.json",
    }
    unsupported = [
        a for a in auth_types if a in ("token", "oauth") and a not in mapping
    ]
    if unsupported:
        logger.warning(
            "Auth types %s are not supported as database authType $ref schemas. "
            "They will be added as direct connection properties instead.",
            unsupported,
        )
    return [{"$ref": mapping[a]} for a in auth_types if a in mapping]


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


def _gen_unit_test_database(p: ConnectorProfile) -> str:
    camel = p.camel
    port = p.default_port or 5432
    return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} using the topology
"""
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.{p.name}.metadata import {camel}Source

mock_{p.name}_config = {{
    "source": {{
        "type": "{p.name.replace("_", "-")}",
        "serviceName": "test_{p.name}",
        "serviceConnection": {{
            "config": {{
                "type": "{camel}",
                "hostPort": "localhost:{port}",
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
        "openMetadataServerConfig": {{
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {{
                "jwtToken": "token"
            }},
        }},
    }},
}}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="{p.name}_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.{camel},
)


class {camel}UnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_{p.name}_config)
        self.{p.name}_source = {camel}Source.create(
            mock_{p.name}_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.{p.name}_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.{p.name}_source.context.get().__dict__["database"] = "test_db"

    def test_source_config(self):
        assert self.{p.name}_source is not None
        assert self.{p.name}_source.service_connection is not None

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.{p.name}_source.close()
'''


def _gen_unit_test_dashboard(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} using the topology
"""
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.{p.name}.metadata import {camel}Source

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_{p.name}"),
    name="mock_{p.name}",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.{camel},
)

mock_config = {{
    "source": {{
        "type": "{p.name.replace("_", "-")}",
        "serviceName": "mock_{p.name}",
        "serviceConnection": {{
            "config": {{
                "type": "{camel}",
                # TODO: Fill in required connection properties from the schema
                "hostPort": "http://localhost:8080",
            }}
        }},
        "sourceConfig": {{
            "config": {{
                "dashboardFilterPattern": {{}},
                "chartFilterPattern": {{}},
            }}
        }},
    }},
    "sink": {{"type": "metadata-rest", "config": {{}}}},
    "workflowConfig": {{
        "openMetadataServerConfig": {{
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {{
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            }},
        }},
    }},
}}

# TODO: Replace with actual model classes from your client/models.py
# Example mock dashboard details — adapt fields to match your models
MOCK_DASHBOARD_DETAILS = SimpleNamespace(
    id="1",
    name="test_dashboard",
    description="Sample dashboard description",
)

EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="1",
        displayName="test_dashboard",
        description="Sample dashboard description",
        # TODO: Set sourceUrl based on your connector's URL pattern
        sourceUrl="http://localhost:8080/dashboard/1",
        charts=[],
        service=FullyQualifiedEntityName("mock_{p.name}"),
    )
]

# TODO: Replace with actual chart model from your client/models.py
MOCK_CHARTS = [
    SimpleNamespace(id="c1", name="chart1", chart_type="bar"),
    SimpleNamespace(id="c2", name="chart2", chart_type="line"),
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="c1",
        displayName="chart1",
        chartType="Other",
        # TODO: Set sourceUrl for charts
        sourceUrl="http://localhost:8080/chart/c1",
        service=FullyQualifiedEntityName("mock_{p.name}"),
    ),
    CreateChartRequest(
        name="c2",
        displayName="chart2",
        chartType="Other",
        sourceUrl="http://localhost:8080/chart/c2",
        service=FullyQualifiedEntityName("mock_{p.name}"),
    ),
]


class {camel}UnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.dashboard.{p.name}.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.{p.name}: {camel}Source = {camel}Source.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.{p.name}.client = SimpleNamespace()
        self.{p.name}.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

    def test_dashboard_name(self):
        """Test extracting dashboard name from details object"""
        assert (
            self.{p.name}.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_DETAILS.name
        )

    def test_yield_dashboard(self):
        """Test creating a CreateDashboardRequest from dashboard details"""
        results = list(self.{p.name}.yield_dashboard(MOCK_DASHBOARD_DETAILS))
        # TODO: Update once yield_dashboard is implemented
        # self.assertEqual(EXPECTED_DASHBOARD, [res.right for res in results])

    def test_yield_dashboard_chart(self):
        """Test creating CreateChartRequest entities from dashboard details"""
        chart_list = []
        results = self.{p.name}.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)
        # TODO: Update once yield_dashboard_chart is implemented
        # for expected, original in zip(EXPECTED_CHARTS, chart_list):
        #     self.assertEqual(expected, original)

    def test_yield_dashboard_lineage(self):
        """Test that lineage generation does not error (yields nothing by default)"""
        results = list(
            self.{p.name}.yield_dashboard_lineage_details(
                dashboard_details=MOCK_DASHBOARD_DETAILS, db_service_prefix=None
            )
        )
        # Default implementation yields nothing — override if your connector supports lineage
        self.assertEqual(results, [])
'''


def _gen_unit_test_pipeline(p: ConnectorProfile) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} using the topology
"""
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.{p.name}.metadata import {camel}Source

MOCK_PIPELINE_SERVICE = PipelineService(
    id="86ff3c40-7c51-4ff5-9727-738cead28d9a",
    name="{p.name}_source_test",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.{camel},
)

mock_config = {{
    "source": {{
        "type": "{p.name.replace("_", "-")}",
        "serviceName": "{p.name}_source_test",
        "serviceConnection": {{
            "config": {{
                "type": "{camel}",
                # TODO: Fill in required connection properties
                "hostPort": "http://localhost:8080",
            }}
        }},
        "sourceConfig": {{
            "config": {{
                "type": "PipelineMetadata",
            }}
        }},
    }},
    "sink": {{"type": "metadata-rest", "config": {{}}}},
    "workflowConfig": {{
        "openMetadataServerConfig": {{
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {{
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            }},
        }},
    }},
}}

# TODO: Replace with actual pipeline details from your API response
MOCK_PIPELINE_DETAILS = SimpleNamespace(
    id="1",
    name="test_pipeline",
    description="Sample pipeline",
    tasks=[
        SimpleNamespace(id="t1", name="task_1", description="First task"),
        SimpleNamespace(id="t2", name="task_2", description="Second task"),
    ],
)

EXPECTED_PIPELINE = [
    CreatePipelineRequest(
        name="1",
        displayName="test_pipeline",
        description="Sample pipeline",
        tasks=[
            Task(name="t1", displayName="task_1", description="First task"),
            Task(name="t2", displayName="task_2", description="Second task"),
        ],
        service="{p.name}_source_test",
    )
]


class {camel}UnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.pipeline.{p.name}.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.{p.name} = {camel}Source.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.{p.name}.client = SimpleNamespace()
        self.{p.name}.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

    def test_pipeline_name(self):
        """Test extracting pipeline name from details object"""
        assert (
            self.{p.name}.get_pipeline_name(MOCK_PIPELINE_DETAILS)
            == MOCK_PIPELINE_DETAILS.name
        )

    def test_yield_pipeline(self):
        """Test creating a CreatePipelineRequest from pipeline details"""
        results = list(self.{p.name}.yield_pipeline(MOCK_PIPELINE_DETAILS))
        # TODO: Update once yield_pipeline is implemented
        # pipeline_list = [r.right for r in results if isinstance(r, Either) and r.right]
        # for expected, original in zip(EXPECTED_PIPELINE, pipeline_list):
        #     self.assertEqual(expected, original)

    def test_yield_pipeline_status(self):
        """Test creating pipeline execution status"""
        self.{p.name}.context.get().__dict__["pipeline"] = "test_pipeline"
        results = list(self.{p.name}.yield_pipeline_status(MOCK_PIPELINE_DETAILS))
        # TODO: Update once yield_pipeline_status is implemented
        # status_list = [r.right for r in results if isinstance(r, Either) and r.right]
        # assert len(status_list) > 0

    def test_yield_pipeline_lineage(self):
        """Test that lineage generation does not error"""
        results = list(
            self.{p.name}.yield_pipeline_lineage_details(
                pipeline_details=MOCK_PIPELINE_DETAILS
            )
        )
        # Default implementation yields nothing — override if your connector supports lineage
        self.assertEqual(results, [])
'''


def _gen_unit_test_generic(p: ConnectorProfile) -> str:
    """Generate unit tests for messaging, mlmodel, storage, search, api connectors."""
    camel = p.camel
    base_class_name, base_class_module = BASE_CLASS_MAP[p.service_type]
    svc_type_map = {
        "messaging": (
            "MessagingServiceType",
            "messagingService",
            "MessagingConnection",
            "MessagingService",
        ),
        "mlmodel": (
            "MlModelServiceType",
            "mlmodelService",
            "MlModelConnection",
            "MlModelService",
        ),
        "storage": (
            "StorageServiceType",
            "storageService",
            "StorageConnection",
            "StorageService",
        ),
        "search": (
            "SearchServiceType",
            "searchService",
            "SearchConnection",
            "SearchService",
        ),
        "api": (
            "ApiServiceType",
            "apiService",
            "ApiConnection",
            "ApiService",
        ),
    }
    type_enum, svc_module, conn_class, svc_class = svc_type_map.get(
        p.service_type,
        (
            "MessagingServiceType",
            "messagingService",
            "MessagingConnection",
            "MessagingService",
        ),
    )
    return f'''{COPYRIGHT_HEADER}
"""
Unit tests for {camel} using the topology
"""
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.{svc_module} import (
    {conn_class},
    {svc_class},
    {type_enum},
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.{p.service_type}.{p.name}.metadata import {camel}Source

MOCK_SERVICE = {svc_class}(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="mock_{p.name}",
    connection={conn_class}(),
    serviceType={type_enum}.{camel},
)

mock_config = {{
    "source": {{
        "type": "{p.name.replace("_", "-")}",
        "serviceName": "mock_{p.name}",
        "serviceConnection": {{
            "config": {{
                "type": "{camel}",
                # TODO: Fill in required connection properties
            }}
        }},
        "sourceConfig": {{
            "config": {{}}
        }},
    }},
    "sink": {{"type": "metadata-rest", "config": {{}}}},
    "workflowConfig": {{
        "openMetadataServerConfig": {{
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {{
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            }},
        }},
    }},
}}


class {camel}UnitTest(TestCase):
    @patch(
        "{base_class_module}.{base_class_name}.test_connection"
    )
    @patch("metadata.ingestion.source.{p.service_type}.{p.name}.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.{p.name} = {camel}Source.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.{p.name}.client = SimpleNamespace()

    def test_source_creation(self):
        """Test that the source is properly created from config"""
        assert self.{p.name} is not None
        assert self.{p.name}.service_connection is not None

    def test_service_connection_type(self):
        """Test that the service connection type is correct"""
        assert self.{p.name}.service_connection.type.value == "{camel}"
'''


def gen_unit_test(p: ConnectorProfile) -> str:
    if p.service_type == "database":
        return _gen_unit_test_database(p)
    if p.service_type == "dashboard":
        return _gen_unit_test_dashboard(p)
    if p.service_type == "pipeline":
        return _gen_unit_test_pipeline(p)
    return _gen_unit_test_generic(p)


def gen_integration_conftest(p: ConnectorProfile) -> str:
    camel = p.camel
    if not p.docker_image:
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
    Provide a Docker image via scaffold --docker-image to auto-generate this.
    """
    yield None
'''

    port = p.docker_port or 80
    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        return _gen_integration_conftest_database(p, port)
    return _gen_integration_conftest_non_database(p, port)


def _gen_integration_conftest_database(p: ConnectorProfile, port: int) -> str:
    camel = p.camel
    return f'''{COPYRIGHT_HEADER}
"""
{camel} integration test fixtures — testcontainers
"""
import os
import uuid

import pytest
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


@pytest.fixture(scope="package")
def {p.name}_container(tmp_path_factory):
    """Start a {camel} container for integration testing."""
    container = DockerContainer("{p.docker_image}")
    container.with_exposed_ports({port})
    # TODO: Add environment variables needed by the container
    # container.with_env("ACCEPT_EULA", "Y")
    # container.with_env("SA_PASSWORD", "YourStrong!Passw0rd")
    with (
        try_bind(container, {port}, {port + 1}) if not os.getenv("CI") else container
    ) as container:
        # TODO: Wait for the container to be ready
        # import time; time.sleep(30)
        # TODO: Create sample data — e.g. run SQL scripts inside the container
        # docker_container = container.get_wrapped_container()
        # docker_container.exec_run(["sh", "-c", "..."])
        yield container


@pytest.fixture(scope="module")
def create_service_request({p.name}_container):
    return CreateDatabaseServiceRequest.model_validate(
        {{
            "name": f"docker_test_{p.name}_{{uuid.uuid4().hex[:8]}}",
            "serviceType": DatabaseServiceType.{camel}.value,
            "connection": {{
                "config": {{
                    "type": "{camel}",
                    "username": "test",
                    "authType": {{"password": "test"}},
                    "hostPort": "localhost:"
                    + {p.name}_container.get_exposed_port({port}),
                }}
            }},
        }}
    )
'''


def _gen_integration_conftest_non_database(p: ConnectorProfile, port: int) -> str:
    camel = p.camel
    svc_type_map = {
        "dashboard": (
            "DashboardServiceType",
            "dashboardService",
            "CreateDashboardServiceRequest",
        ),
        "pipeline": (
            "PipelineServiceType",
            "pipelineService",
            "CreatePipelineServiceRequest",
        ),
        "messaging": (
            "MessagingServiceType",
            "messagingService",
            "CreateMessagingServiceRequest",
        ),
        "mlmodel": (
            "MlModelServiceType",
            "mlmodelService",
            "CreateMlModelServiceRequest",
        ),
        "storage": (
            "StorageServiceType",
            "storageService",
            "CreateStorageServiceRequest",
        ),
        "search": ("SearchServiceType", "searchService", "CreateSearchServiceRequest"),
        "api": ("ApiServiceType", "apiService", "CreateApiServiceRequest"),
    }
    type_enum, svc_module, create_req = svc_type_map.get(
        p.service_type,
        ("DashboardServiceType", "dashboardService", "CreateDashboardServiceRequest"),
    )
    return f'''{COPYRIGHT_HEADER}
"""
{camel} integration test fixtures — testcontainers
"""
import os
import time
import uuid

import pytest
import requests
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.helpers.docker import try_bind


@pytest.fixture(scope="package")
def {p.name}_container(tmp_path_factory):
    """Start a {camel} container for integration testing."""
    container = DockerContainer("{p.docker_image}")
    container.with_exposed_ports({port})
    # TODO: Add environment variables needed by the container
    # container.with_env("MB_DB_TYPE", "h2")
    with (
        try_bind(container, {port}, {port + 1}) if not os.getenv("CI") else container
    ) as container:
        host = container.get_container_host_ip()
        exposed_port = container.get_exposed_port({port})
        # Wait for the service to be ready
        _wait_for_service(f"http://{{host}}:{{exposed_port}}")
        # TODO: Create sample data via API calls
        # _create_sample_data(host, exposed_port)
        yield container


def _wait_for_service(url: str, timeout: int = 120, interval: int = 5):
    """Poll the service until it responds."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code < 500:
                return
        except requests.ConnectionError:
            pass
        time.sleep(interval)
    raise TimeoutError(f"Service at {{url}} did not become ready within {{timeout}}s")


# TODO: Implement sample data creation
# def _create_sample_data(host: str, port: str):
#     \"\"\"Create sample dashboards/charts/etc. via the API.\"\"\"
#     session = requests.Session()
#     # 1. Authenticate
#     # 2. Create sample entities
#     pass
'''


def gen_integration_test_metadata(p: ConnectorProfile) -> str:
    camel = p.camel
    if not p.docker_image:
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

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        return f'''{COPYRIGHT_HEADER}
"""
{camel} integration tests — real E2E with testcontainers
"""
from metadata.workflow.metadata import MetadataWorkflow


def test_ingest_metadata(
    patch_passwords_for_db_services, run_workflow, ingestion_config
):
    run_workflow(MetadataWorkflow, ingestion_config)
'''
    return f'''{COPYRIGHT_HEADER}
"""
{camel} integration tests — real E2E with testcontainers
"""
import uuid

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.services.create{p.service_type.capitalize()}Service import (
    Create{p.service_type.capitalize()}ServiceRequest,
)
from metadata.generated.schema.entity.services.{p.service_type}Service import (
    {p.service_type.capitalize()}Service,
    {p.service_type.capitalize()}ServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    Source as WorkflowSource,
)
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def {p.name}_service(metadata, {p.name}_container):
    """Create an OpenMetadata service pointing at the test container."""
    host = {p.name}_container.get_container_host_ip()
    port = {p.name}_container.get_exposed_port({p.docker_port or 80})
    request = Create{p.service_type.capitalize()}ServiceRequest(
        name=f"docker_test_{p.name}_{{uuid.uuid4().hex[:8]}}",
        serviceType={p.service_type.capitalize()}ServiceType.{camel},
        connection={{
            "config": {{
                "type": "{camel}",
                "hostPort": f"http://{{host}}:{{port}}",
                # TODO: Add auth credentials matching the container setup
            }}
        }},
    )
    service = metadata.create_or_update(data=request)
    yield service
    metadata.delete(
        entity={p.service_type.capitalize()}Service,
        entity_id=service.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def ingestion_config({p.name}_service, metadata):
    return {{
        "source": {{
            "type": "{p.name.replace("_", "-")}",
            "serviceName": {p.name}_service.fullyQualifiedName.root,
            "sourceConfig": {{
                "config": {{"type": "{p.service_type.capitalize()}Metadata"}}
            }},
            "serviceConnection": {p.name}_service.connection.model_dump(),
        }},
        "sink": {{"type": "metadata-rest", "config": {{}}}},
        "workflowConfig": {{
            "loggerLevel": LogLevels.DEBUG.value,
            "openMetadataServerConfig": metadata.config.model_dump(),
        }},
    }}


class Test{camel}Metadata:
    def test_ingest_metadata(self, {p.name}_service, ingestion_config):
        """Run the full metadata ingestion workflow against the test container."""
        workflow = MetadataWorkflow.create(ingestion_config)
        workflow.execute()
        workflow.print_status()
        workflow.raise_from_status()

    # TODO: Add assertions on extracted entities
    # def test_dashboards_ingested(self, {p.name}_service, metadata):
    #     dashboards = metadata.list_entities(
    #         entity=Dashboard,
    #         params={{"service": {p.name}_service.fullyQualifiedName.root}},
    #     )
    #     assert dashboards.entities
'''


def gen_integration_connection_test(p: ConnectorProfile) -> str:
    camel = p.camel
    if not p.docker_image:
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

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        return f'''{COPYRIGHT_HEADER}
"""
{camel} connection integration tests — testcontainers
"""
import pytest

from metadata.generated.schema.entity.services.connections.database.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.ingestion.source.database.{p.name}.connection import {camel}Connection as {camel}Conn


class Test{camel}Connection:
    def test_get_connection(self, {p.name}_container):
        """Test that connection returns a valid engine."""
        config = {camel}Connection(
            hostPort="localhost:" + {p.name}_container.get_exposed_port({p.docker_port or p.default_port or 5432}),
            username="test",
            authType={{"password": "test"}},
        )
        conn = {camel}Conn(config)
        client = conn.client
        assert client is not None
'''
    port = p.docker_port or 80
    return f'''{COPYRIGHT_HEADER}
"""
{camel} connection integration tests — testcontainers
"""
import pytest

from metadata.generated.schema.entity.services.connections.{p.service_type}.{p.module_name}Connection import (
    {camel}Connection,
)
from metadata.ingestion.source.{p.service_type}.{p.name}.connection import (
    get_connection,
    test_connection,
)


class Test{camel}Connection:
    def test_get_connection(self, {p.name}_container):
        """Test that get_connection returns a valid client."""
        host = {p.name}_container.get_container_host_ip()
        port = {p.name}_container.get_exposed_port({port})
        config = {camel}Connection(
            hostPort=f"http://{{host}}:{{port}}",
            # TODO: Add auth credentials matching the container setup
        )
        client = get_connection(config)
        assert client is not None

    def test_test_access(self, {p.name}_container):
        """Test that the client can access the service."""
        host = {p.name}_container.get_container_host_ip()
        port = {p.name}_container.get_exposed_port({port})
        config = {camel}Connection(
            hostPort=f"http://{{host}}:{{port}}",
            # TODO: Add auth credentials matching the container setup
        )
        client = get_connection(config)
        client.test_access()
'''


# ---------------------------------------------------------------------------
# CONNECTOR_CONTEXT.md — the AI agent brief
# ---------------------------------------------------------------------------


ABSTRACT_METHODS = {
    "database": [],  # CommonDbSourceService has no required abstract methods
    "dashboard": [
        (
            "get_dashboards_list(self)",
            "Optional[List[Any]]",
            "Return list of all dashboard objects from the source",
        ),
        (
            "get_dashboard_name(self, dashboard: Any)",
            "str",
            "Extract name from a dashboard object",
        ),
        (
            "get_dashboard_details(self, dashboard: Any)",
            "Any",
            "Fetch full dashboard details for a given dashboard",
        ),
        (
            "yield_dashboard(self, dashboard_details: Any)",
            "Iterable[Either[CreateDashboardRequest]]",
            "Create and yield a CreateDashboardRequest entity",
        ),
        (
            "yield_dashboard_chart(self, dashboard_details: Any)",
            "Iterable[Either[CreateChartRequest]]",
            "Create and yield CreateChartRequest entities for each chart",
        ),
        (
            "yield_dashboard_lineage_details(self, dashboard_details: Any, db_service_prefix: Optional[str] = None)",
            "Iterable[Either[AddLineageRequest]]",
            "Yield lineage between dashboard and data sources (can yield nothing if N/A)",
        ),
    ],
    "pipeline": [
        (
            "get_pipelines_list(self)",
            "Optional[List[Any]]",
            "Return list of all pipeline objects from the source",
        ),
        (
            "get_pipeline_name(self, pipeline_details: Any)",
            "str",
            "Extract name from a pipeline object",
        ),
        (
            "yield_pipeline(self, pipeline_details: Any)",
            "Iterable[Either[CreatePipelineRequest]]",
            "Create and yield a CreatePipelineRequest entity with tasks",
        ),
        (
            "yield_pipeline_status(self, pipeline_details: Any)",
            "Iterable[Either[OMetaPipelineStatus]]",
            "Yield pipeline execution status",
        ),
        (
            "yield_pipeline_lineage_details(self, pipeline_details: Any)",
            "Iterable[Either[AddLineageRequest]]",
            "Yield lineage between pipeline and data sources",
        ),
    ],
    "messaging": [
        (
            "get_topic_list(self)",
            "Optional[List[Any]]",
            "Return list of all topic objects",
        ),
        (
            "get_topic_name(self, topic_details: Any)",
            "str",
            "Extract name from a topic object",
        ),
        (
            "yield_topic(self, topic_details: Any)",
            "Iterable[Either[CreateTopicRequest]]",
            "Create and yield a CreateTopicRequest entity",
        ),
    ],
    "mlmodel": [
        (
            "get_mlmodels(self, *args, **kwargs)",
            "Iterable",
            "List all ML models to process",
        ),
        ("yield_mlmodel(self, *args, **kwargs)", "Iterable", "Yield MlModel entities"),
        (
            "_get_hyper_params(self, *args, **kwargs)",
            "Optional[List]",
            "Get hyper parameters from the model",
        ),
        (
            "_get_ml_store(self, *args, **kwargs)",
            "Optional",
            "Get the ML store from the model version",
        ),
        (
            "_get_ml_features(self, *args, **kwargs)",
            "Optional[List]",
            "Pick up features from the model",
        ),
        (
            "_get_algorithm(self, *args, **kwargs)",
            "str",
            "Return the algorithm for a given model",
        ),
    ],
    "storage": [
        ("get_containers(self)", "Iterable", "Retrieve all containers for the service"),
        (
            "yield_create_container_requests(self, container_details: Any)",
            "Iterable",
            "Generate create container requests",
        ),
    ],
    "search": [
        (
            "get_search_index_list(self)",
            "Optional[List[Any]]",
            "Return list of all search indexes",
        ),
        (
            "get_search_index_name(self, search_index_details: Any)",
            "str",
            "Extract name from a search index object",
        ),
        (
            "yield_search_index(self, search_index_details: Any)",
            "Iterable",
            "Create and yield search index entities",
        ),
    ],
    "api": [
        (
            "get_api_collections(self, *args, **kwargs)",
            "Iterable",
            "List all API collections to process",
        ),
        (
            "yield_api_collection(self, *args, **kwargs)",
            "Iterable",
            "Yield API collection entities",
        ),
        (
            "yield_api_endpoint(self, *args, **kwargs)",
            "Iterable",
            "Yield API endpoint entities",
        ),
    ],
}

BASE_CLASS_FILES = {
    "database": "ingestion/src/metadata/ingestion/source/database/common_db_source.py",
    "dashboard": "ingestion/src/metadata/ingestion/source/dashboard/dashboard_service.py",
    "pipeline": "ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py",
    "messaging": "ingestion/src/metadata/ingestion/source/messaging/messaging_service.py",
    "mlmodel": "ingestion/src/metadata/ingestion/source/mlmodel/mlmodel_service.py",
    "storage": "ingestion/src/metadata/ingestion/source/storage/storage_service.py",
    "search": "ingestion/src/metadata/ingestion/source/search/search_service.py",
    "api": "ingestion/src/metadata/ingestion/source/api/api_service.py",
}

UI_UTILS_FILES = {
    "database": "openmetadata-ui/src/main/resources/ui/src/utils/DatabaseServiceUtils.tsx",
    "dashboard": "openmetadata-ui/src/main/resources/ui/src/utils/DashboardServiceUtils.ts",
    "pipeline": "openmetadata-ui/src/main/resources/ui/src/utils/PipelineServiceUtils.ts",
    "messaging": "openmetadata-ui/src/main/resources/ui/src/utils/MessagingServiceUtils.ts",
    "mlmodel": "openmetadata-ui/src/main/resources/ui/src/utils/MlmodelServiceUtils.ts",
    "storage": "openmetadata-ui/src/main/resources/ui/src/utils/StorageServiceUtils.ts",
    "search": "openmetadata-ui/src/main/resources/ui/src/utils/SearchServiceUtils.ts",
    "api": "openmetadata-ui/src/main/resources/ui/src/utils/APIServiceUtils.ts",
}


def generate_connector_context(p: ConnectorProfile, root: Path) -> str:
    camel = p.camel
    ref = REFERENCE_CONNECTORS.get(p.service_type, "mysql")
    base_class, base_module = BASE_CLASS_MAP[p.service_type]

    source_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{p.name}"
    ref_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{ref}"
    svc_schema = f"openmetadata-spec/src/main/resources/json/schema/entity/services/{p.service_type}Service.json"
    conn_schema = f"openmetadata-spec/src/main/resources/json/schema/entity/services/connections/{p.service_type}/{p.module_name}Connection.json"
    test_conn = f"openmetadata-service/src/main/resources/json/data/testConnections/{p.service_type}/{p.module_name}.json"
    ui_utils = UI_UTILS_FILES.get(p.service_type, "")
    base_class_file = BASE_CLASS_FILES.get(p.service_type, "")

    s = []
    s.append(f"# {camel} Connector — Implementation Brief")
    s.append("")
    s.append("## Instructions")
    s.append("")
    s.append("You are implementing a new OpenMetadata connector. This file contains")
    s.append("everything you need. Follow these steps in order:")
    s.append("")
    s.append("1. **Set up the development environment**")
    s.append("2. **Read the reference connector** to learn the patterns")
    s.append("3. **Implement the TODO items** in the generated files")
    s.append("4. **Register the connector** in the service schema and UI")
    s.append("5. **Run code generation** and formatting")
    s.append("6. **Run tests** and validate")
    s.append("")
    s.append("Do NOT skip steps. Do NOT guess patterns — copy them from the reference.")
    s.append("")

    # --- Environment Setup ---
    s.append("## Prerequisites: Environment Setup")
    s.append("")
    s.append(
        "Before running any `make` or `python` commands, set up the Python environment:"
    )
    s.append("")
    s.append("```bash")
    s.append("# From the root of the OpenMetadata project")
    s.append("python3.11 -m venv env")
    s.append("source env/bin/activate")
    s.append("make install_dev generate")
    s.append("```")
    s.append("")
    s.append("Always activate the env before running commands:")
    s.append("")
    s.append("```bash")
    s.append("source env/bin/activate")
    s.append("```")
    s.append("")

    # --- Profile ---
    s.append("## Connector Profile")
    s.append("")
    s.append(f"- **Name**: `{camel}`")
    s.append(f"- **Service Type**: `{p.service_type}`")
    s.append(f"- **Connection Type**: `{p.connection_type}`")
    s.append(f"- **Base Class**: `{base_class}` from `{base_module}`")
    s.append(f"- **Auth Types**: {', '.join(p.auth_types)}")
    s.append(f"- **Capabilities**: {', '.join(p.capabilities)}")
    if p.description:
        s.append(f"- **Description**: {p.description}")
    if p.scheme:
        s.append(f"- **SQLAlchemy Scheme**: `{p.scheme}`")
    if p.default_port:
        s.append(f"- **Default Port**: {p.default_port}")
    if p.sdk_package:
        s.append(f"- **Python SDK Package**: `{p.sdk_package}`")
    s.append("")

    # --- Source docs ---
    if p.docs_url or p.api_endpoints or p.docs_notes:
        s.append("## Source Documentation")
        s.append("")
        if p.docs_url:
            s.append(f"- **API Docs**: {p.docs_url}")
        if p.sdk_package:
            s.append(f"- **SDK**: `pip install {p.sdk_package}`")
        if p.api_endpoints:
            s.append(f"- **Key Endpoints**: {p.api_endpoints}")
        if p.docs_notes:
            s.append("")
            s.append("### Notes")
            s.append(p.docs_notes)
        s.append("")

    # --- Step 1: Read reference ---
    s.append("## Step 1: Read the Reference Connector")
    s.append("")
    s.append(
        f"The `{ref}` connector is the closest reference. **Read these files first**:"
    )
    s.append("")

    ref_files = [f"{ref_dir}/metadata.py", f"{ref_dir}/connection.py"]
    if p.service_type == "database":
        ref_files.append(f"{ref_dir}/queries.py")
    else:
        client_path = f"{ref_dir}/client.py"
        # check if ref has a client.py
        if (root / client_path).exists():
            ref_files.append(client_path)
        models_path = f"{ref_dir}/models.py"
        if (root / models_path).exists():
            ref_files.append(models_path)
    ref_files.append(f"{ref_dir}/service_spec.py")

    for rf in ref_files:
        s.append(f"- `{rf}`")
    s.append("")
    s.append(
        f"Also read the base class to understand the topology and abstract methods:"
    )
    s.append(f"- `{base_class_file}`")
    s.append("")

    # --- Step 2: Implement ---
    s.append("## Step 2: Implement the Generated Files")
    s.append("")
    s.append("Each file below has `# TODO` markers. Implement them.")
    s.append("")

    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        s.append(f"### `{source_dir}/connection.py`")
        s.append(
            f"- `_get_client()` — Return a SQLAlchemy `Engine`. The default `create_generic_db_connection` works if the DB uses standard host/port/user/password. Customize for special auth (e.g., token injection)."
        )
        s.append(
            f"- `test_connection()` — Usually works as-is with `test_connection_db_schema_sources`."
        )
        s.append("")
        s.append(f"### `{source_dir}/metadata.py`")
        s.append(
            f"- Usually works as-is via `CommonDbSourceService`. Override only for custom behavior (stored procedures, custom type mapping)."
        )
        s.append("")
        s.append(f"### `{source_dir}/queries.py`")
        s.append("- Add SQL queries for metadata extraction or query log access.")
        s.append("")
        if "lineage" in p.capabilities:
            s.append(f"### `{source_dir}/lineage.py`")
            s.append(
                "- Set `filters` to SQL conditions that identify lineage-relevant queries (CREATE TABLE AS SELECT, INSERT INTO SELECT, MERGE, etc.)."
            )
            s.append("")
            s.append(f"### `{source_dir}/query_parser.py`")
            s.append(
                "- Implement `get_sql_statement()` to return the SQL that fetches query logs from the source's audit/log tables."
            )
            s.append("")
        if "usage" in p.capabilities:
            s.append(f"### `{source_dir}/usage.py`")
            s.append(
                '- Usually just sets `filters = ""` to capture all queries for usage analysis.'
            )
            s.append("")
    else:
        s.append(f"### `{source_dir}/client.py` (main implementation work)")
        s.append("")
        s.append("Build the REST/SDK client. Required methods:")
        s.append("")
        s.append(
            "- `__init__(self, config)` — Initialize HTTP session or SDK client, set up auth"
        )
        s.append(
            "- `test_access(self)` — Make a lightweight API call to verify credentials work"
        )
        s.append("")
        s.append(
            "Add methods for each API operation needed by `metadata.py`. For example:"
        )
        s.append("")
        if p.service_type == "dashboard":
            s.append("- `get_dashboards(self)` — List all dashboards")
            s.append(
                "- `get_dashboard_details(self, dashboard_id)` — Get full dashboard details"
            )
            s.append("- `get_charts(self, dashboard_id)` — List charts for a dashboard")
        elif p.service_type == "pipeline":
            s.append("- `get_pipelines(self)` — List all pipelines")
            s.append("- `get_pipeline_runs(self, pipeline_id)` — Get execution history")
            s.append("- `get_tasks(self, pipeline_id)` — List tasks for a pipeline")
        elif p.service_type == "messaging":
            s.append("- `get_topics(self)` — List all topics")
            s.append(
                "- `get_topic_details(self, topic_name)` — Get topic metadata/schema"
            )
        elif p.service_type == "search":
            s.append("- `get_indexes(self)` — List all search indexes")
            s.append(
                "- `get_index_mapping(self, index_name)` — Get index field mappings"
            )
        elif p.service_type == "api":
            s.append("- `get_collections(self)` — List all API collections")
            s.append(
                "- `get_endpoints(self, collection_id)` — List endpoints in a collection"
            )
        elif p.service_type == "storage":
            s.append("- `get_containers(self)` — List all containers/buckets")
        elif p.service_type == "mlmodel":
            s.append("- `get_models(self)` — List all ML models")
            s.append("- `get_model_versions(self, model_name)` — Get model versions")
        s.append("")

        s.append(f"### `{source_dir}/connection.py`")
        s.append("")
        s.append(
            "Already wired. Update the `test_fn` dict keys to match the step names"
        )
        s.append(f"in `{test_conn}`. Add client methods for each test step.")
        s.append("")

        s.append(f"### `{source_dir}/metadata.py`")
        s.append("")
        s.append(
            f"Extends `{base_class}`. You **must** implement these abstract methods:"
        )
        s.append("")

        methods = ABSTRACT_METHODS.get(p.service_type, [])
        for sig, ret, desc in methods:
            s.append(f"- `{sig}` -> `{ret}` — {desc}")
        s.append("")

    s.append(f"### `{source_dir}/service_spec.py`")
    s.append("Already complete. No changes needed.")
    s.append("")

    # --- Optional capability overrides for non-database ---
    if p.service_type != "database":
        optional_overrides = []
        if p.service_type == "dashboard":
            optional_overrides = [
                (
                    "yield_dashboard_lineage_details(self, dashboard_details, db_service_prefix=None)",
                    "Iterable[Either[AddLineageRequest]]",
                    "Dashboard-to-table lineage. Parse SQL from charts or map dashboard data sources to database tables. See metabase or tableau metadata.py for examples.",
                ),
                (
                    "yield_dashboard_usage(self, dashboard_details)",
                    "Iterable[Either[DashboardUsage]]",
                    "Dashboard view counts. Fetch usage/view count from the API and yield DashboardUsage. See tableau or looker metadata.py for examples.",
                ),
                (
                    "yield_bulk_datamodel(self, _)",
                    "Iterable[Either[CreateDashboardDataModelRequest]]",
                    "Data models (e.g. LookML views, Tableau datasources). See looker metadata.py for examples.",
                ),
                (
                    "get_owner_ref(self, dashboard_details)",
                    "Optional[EntityReferenceList]",
                    "Dashboard ownership. Resolve owner email to OpenMetadata user reference.",
                ),
                (
                    "get_project_name(self, dashboard_details)",
                    "Optional[str]",
                    "Folder/project/workspace name for organizing dashboards.",
                ),
            ]
        elif p.service_type == "pipeline":
            optional_overrides = [
                (
                    "yield_pipeline_lineage_details(self, pipeline_details)",
                    "Iterable[Either[AddLineageRequest]]",
                    "Pipeline-to-table lineage. Map pipeline tasks to source/target database tables. See airflow or fivetran metadata.py for examples.",
                ),
            ]

        if optional_overrides:
            s.append("### Optional Capability Overrides (in `metadata.py`)")
            s.append("")
            s.append(
                "These are **not required** but can be implemented by overriding the"
            )
            s.append("default no-op methods in the base class. No extra files needed.")
            s.append("")
            for sig, ret, desc in optional_overrides:
                s.append(f"- `{sig}` -> `{ret}` — {desc}")
            s.append("")

    # --- Step 3: Register ---
    s.append("## Step 3: Register the Connector")
    s.append("")
    s.append("After implementation, modify these existing files:")
    s.append("")
    s.append(f"### 3a. Service schema: `{svc_schema}`")
    s.append("")
    s.append(f'- Add `"{camel}"` to the `{p.service_type}ServiceType` enum array')
    s.append(f"- Add to the connection `oneOf` array:")
    s.append(f"  ```json")
    s.append(
        f'  {{"$ref": "connections/{p.service_type}/{p.module_name}Connection.json"}}'
    )
    s.append(f"  ```")
    s.append("")
    s.append(f"### 3b. UI service utils: `{ui_utils}`")
    s.append("")
    s.append(f"- Import the resolved connection schema for `{camel}`")
    s.append(
        f"- Add a `case '{camel}':` in the switch statement that returns the schema"
    )
    s.append("")
    s.append("### 3c. Localization")
    s.append("")
    s.append(
        "- Add i18n keys in `openmetadata-ui/src/main/resources/ui/src/locale/languages/`"
    )
    s.append(f'- Add display name entry for `"{camel}"` service')
    s.append("")

    # --- Step 4: Code gen ---
    s.append("## Step 4: Code Generation and Formatting")
    s.append("")
    s.append("Run these commands in order:")
    s.append("")
    s.append("```bash")
    s.append("# Activate the Python environment")
    s.append("source env/bin/activate")
    s.append("")
    s.append("# Generate Python Pydantic models from JSON Schema")
    s.append("make generate")
    s.append("")
    s.append("# Generate Java models from JSON Schema")
    s.append("mvn clean install -pl openmetadata-spec")
    s.append("")
    s.append("# Generate resolved JSON for UI forms")
    s.append("cd openmetadata-ui/src/main/resources/ui && yarn parse-schema")
    s.append("")
    s.append("# Format and lint Python code")
    s.append("make py_format")
    s.append("")
    s.append("# Format Java code")
    s.append("mvn spotless:apply")
    s.append("```")
    s.append("")

    # --- Step 5: Run tests ---
    s.append("## Step 5: Run Tests")
    s.append("")
    s.append("```bash")
    s.append("source env/bin/activate")
    s.append("")
    s.append("# Unit tests")
    s.append(
        f"python -m pytest ingestion/tests/unit/topology/{p.service_type}/test_{p.name}.py -v"
    )
    s.append("")
    s.append("# Integration tests (requires OpenMetadata server running locally)")
    s.append(f"python -m pytest ingestion/tests/integration/{p.name}/ -v")
    s.append("")
    s.append("# Connection integration test")
    s.append(
        f"python -m pytest ingestion/tests/integration/connections/test_{p.name}_connection.py -v"
    )
    s.append("```")
    s.append("")
    if p.docker_image:
        s.append(
            f"Integration tests use `testcontainers` with Docker image `{p.docker_image}`."
        )
        s.append(
            "Docker must be running. The container is started and stopped automatically."
        )
        s.append("")
    else:
        s.append(
            "Note: Integration tests are stubs. To enable real E2E testing, either:"
        )
        s.append(
            "- Re-run scaffold with `--docker-image` to generate testcontainers-based tests"
        )
        s.append(
            "- Manually update `ingestion/tests/integration/{}/conftest.py` with a container or mock server".format(
                p.name
            )
        )
        s.append("")

    # --- Step 6: Validate ---
    s.append("## Step 6: Validate Checklist")
    s.append("")
    s.append("- [ ] `make generate` succeeds")
    s.append("- [ ] `mvn clean install -pl openmetadata-spec` succeeds")
    s.append("- [ ] `yarn parse-schema` succeeds")
    s.append("- [ ] Unit tests pass")
    s.append("- [ ] Integration tests pass (if Docker available)")
    s.append("- [ ] `make py_format` passes (run from repo root with env activated)")
    s.append("- [ ] `mvn spotless:apply` passes")
    s.append("")

    # --- Files index ---
    s.append("## Generated Files Index")
    s.append("")
    s.append("| File | Purpose |")
    s.append("|------|---------|")
    s.append(f"| `{conn_schema}` | Connection JSON Schema (single source of truth) |")
    s.append(f"| `{test_conn}` | Test connection step definitions |")
    s.append(f"| `{source_dir}/connection.py` | Connection handler |")
    s.append(f"| `{source_dir}/metadata.py` | Source class with extraction logic |")
    s.append(f"| `{source_dir}/service_spec.py` | ServiceSpec registration |")
    if p.service_type == "database" and p.connection_type == "sqlalchemy":
        s.append(f"| `{source_dir}/queries.py` | SQL query templates |")
        if "lineage" in p.capabilities:
            s.append(f"| `{source_dir}/lineage.py` | Lineage extraction |")
            s.append(f"| `{source_dir}/query_parser.py` | Query log parser |")
        if "usage" in p.capabilities:
            s.append(f"| `{source_dir}/usage.py` | Usage extraction |")
    else:
        s.append(f"| `{source_dir}/client.py` | REST/SDK client |")
    s.append(
        f"| `ingestion/tests/unit/topology/{p.service_type}/test_{p.name}.py` | Unit tests |"
    )
    s.append(
        f"| `ingestion/tests/integration/connections/test_{p.name}_connection.py` | Connection integration test |"
    )
    s.append(
        f"| `ingestion/tests/integration/{p.name}/conftest.py` | Test container fixtures |"
    )
    s.append(
        f"| `ingestion/tests/integration/{p.name}/test_metadata.py` | Metadata integration test |"
    )
    s.append("")

    if p.docker_image:
        s.append("## Integration Tests with Docker")
        s.append("")
        s.append(
            f"Docker image `{p.docker_image}` is configured for integration testing."
        )
        s.append("The generated test files use `testcontainers` to:")
        s.append("")
        s.append("1. Spin up a Docker container with the real service")
        s.append("2. Create sample data (you implement this)")
        s.append("3. Run the full ingestion workflow")
        s.append("4. Assert on extracted entities")
        s.append("")
        s.append("**To complete the integration tests:**")
        s.append("")
        s.append(f"1. Edit `ingestion/tests/integration/{p.name}/conftest.py`:")
        s.append("   - Add container environment variables (credentials, config)")
        s.append("   - Implement sample data creation (API calls or SQL scripts)")
        s.append("   - Update `create_service_request` with correct auth")
        s.append("")
        s.append(f"2. Edit `ingestion/tests/integration/{p.name}/test_metadata.py`:")
        s.append("   - Add assertions on extracted entities (count, names, etc.)")
        s.append("")
        s.append("3. Run the tests:")
        s.append("```bash")
        s.append("source env/bin/activate")
        s.append(f"python -m pytest ingestion/tests/integration/{p.name}/ -v")
        s.append("```")
        s.append("")
        s.append(
            "**Reference**: See `ingestion/tests/integration/mysql/conftest.py` for a complete example."
        )
        s.append("")

    return "\n".join(s)


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


def run_scaffold_cli(args: argparse.Namespace) -> None:
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
    profile.docker_image = getattr(args, "docker_image", "") or ""
    profile.docker_port = getattr(args, "docker_port", None)

    if not re.match(r"^[a-z][a-z0-9_]*$", profile.name):
        logger.error("Connector name must be snake_case.")
        sys.exit(1)

    run_scaffold(profile)
