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

Generates:
- Connection JSON Schema (the single source of truth)
- Test connection JSON definition
- Directory structure with skeleton files
- CONNECTOR_CONTEXT.md — the AI agent brief for implementing the connector

For SQLAlchemy database connectors, also generates concrete code templates
(connection.py, metadata.py, service_spec.py, queries.py, lineage.py, usage.py).

For all other connector types, generates skeleton files that point the AI agent
at the reference connector and CONNECTOR_CONTEXT.md for implementation.
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

COPYRIGHT_HEADER = """#  Copyright 2025 OpenMetadata
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

AUTH_CHOICES = ["basic", "iam", "azure", "jwt", "token", "oauth"]

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

# Non-SQLAlchemy database connectors use DatabaseServiceSource (like Salesforce)
DATABASE_NON_SQL_BASE = (
    "DatabaseServiceSource",
    "metadata.ingestion.source.database.database_service",
)

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
        try:
            value = input(f"  {label}{suffix}").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            if default:
                return default
            raise SystemExit(1)
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
        try:
            value = input(f"  {label}{suffix}").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            if defaults:
                return defaults
            raise SystemExit(1)
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
    try:
        return input(f"  {label}{suffix}").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return ""


def _prompt_multiline(label: str, hint: str = "") -> str:
    print(f"  {label}" + (f" ({hint})" if hint else ""))
    print("  Enter text below. Type a blank line to finish:")
    lines = []
    try:
        while True:
            line = input("  > ")
            if not line:
                break
            lines.append(line)
    except EOFError:
        pass
    except KeyboardInterrupt:
        print()
    return "\n".join(lines)


def collect_interactive() -> ConnectorProfile:
    profile = ConnectorProfile()

    print()
    print("=" * 60)
    print("  OpenMetadata Connector Scaffold")
    print("=" * 60)
    print()
    print("  This will guide you through creating a new connector.")
    print("  Generated files include JSON schemas, directory structure,")
    print("  and a CONNECTOR_CONTEXT.md for AI agents to implement from.")
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

    # --- Connection type ---
    if profile.service_type == "database":
        print("--- Connection Type ---")
        print("    sqlalchemy  — Uses SQLAlchemy engine (most common for SQL DBs)")
        print("    rest_api    — Uses REST API client (like Salesforce)")
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
    profile.auth_types = _prompt_multi("Auth types", AUTH_CHOICES, ["basic"])
    print()

    # --- Capabilities ---
    print("--- Capabilities ---")
    if profile.service_type == "database" and profile.connection_type == "sqlalchemy":
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
    elif profile.service_type == "database":
        profile.capabilities = ["metadata"]
        print("    Default: metadata")
        print("    Note: lineage, usage, and profiler require SQLAlchemy connections.")
        print("    For REST/SDK database connectors, these are not auto-generated.")
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
    print("  Provide a Docker image so AI agents can generate real")
    print("  testcontainers-based integration tests.")
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
    return [{"$ref": mapping[a]} for a in auth_types if a in mapping]


def _has_ref_auth(auth_types: list[str]) -> bool:
    return any(a in {"basic", "iam", "azure", "jwt"} for a in auth_types)


def _has_token_auth(auth_types: list[str]) -> bool:
    return "token" in auth_types or "oauth" in auth_types


def generate_connection_schema(p: ConnectorProfile) -> dict:
    """Generate the connection JSON Schema — the single source of truth."""
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
        _add_database_sqlalchemy_props(p, schema, props, required)
    elif p.service_type == "database":
        _add_database_non_sqlalchemy_props(p, props, required)
    elif p.service_type == "dashboard":
        _add_dashboard_props(p, props, required)
    elif p.service_type == "pipeline":
        _add_pipeline_props(p, props, required)
    elif p.service_type == "messaging":
        _add_messaging_props(p, props, required)
    else:
        _add_generic_props(p, props, required)

    return schema


def _add_database_sqlalchemy_props(
    p: ConnectorProfile, schema: dict, props: dict, required: list
) -> None:
    camel = p.camel
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
    if _has_ref_auth(p.auth_types):
        required.append("username")
    auth_refs = _build_auth_refs(p.auth_types)
    if auth_refs:
        props["authType"] = {
            "title": "Auth Configuration Type",
            "description": "Choose Auth Config Type.",
            "mask": True,
            "oneOf": auth_refs,
        }
    if _has_token_auth(p.auth_types):
        props["token"] = {
            "title": "API Token",
            "description": f"API token to authenticate with {camel}.",
            "type": "string",
            "format": "password",
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


def _add_database_non_sqlalchemy_props(
    p: ConnectorProfile, props: dict, required: list
) -> None:
    camel = p.camel
    props["hostPort"] = {
        "title": "Host and Port",
        "description": f"Host and port of the {camel} service.",
        "type": "string",
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
    if _has_token_auth(p.auth_types):
        props["token"] = {
            "title": "API Token",
            "description": f"API token to authenticate with {camel}.",
            "type": "string",
            "format": "password",
        }
    props["databaseName"] = {
        "title": "Database Name",
        "description": "Optional name to give to the database in OpenMetadata.",
        "type": "string",
    }
    props["databaseSchema"] = {
        "title": "Database Schema",
        "description": "Database Schema of the data source.",
        "type": "string",
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


def _add_dashboard_props(p: ConnectorProfile, props: dict, required: list) -> None:
    camel = p.camel
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
    if _has_token_auth(p.auth_types):
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


def _add_pipeline_props(p: ConnectorProfile, props: dict, required: list) -> None:
    camel = p.camel
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
    if _has_token_auth(p.auth_types):
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


def _add_messaging_props(p: ConnectorProfile, props: dict, required: list) -> None:
    camel = p.camel
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


def _add_generic_props(p: ConnectorProfile, props: dict, required: list) -> None:
    camel = p.camel
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
    if _has_token_auth(p.auth_types):
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


def generate_test_connection_json(p: ConnectorProfile) -> dict:
    """Generate the test connection JSON definition."""
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
                "List the tables belonging to a schema.",
                True,
            ),
            (
                "GetViews",
                "List the views belonging to a schema.",
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
# File generators — SQLAlchemy database templates (mature, match real patterns)
# ---------------------------------------------------------------------------


def gen_init_py() -> str:
    return COPYRIGHT_HEADER + "\n"


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
        COPYRIGHT_HEADER
        + "\n"
        + "\n".join(imports)
        + "\n\nServiceSpec = DefaultDatabaseSpec(\n"
        + "\n".join(spec_args)
        + "\n)\n"
    )


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


# ---------------------------------------------------------------------------
# Skeleton file generator — for non-SQLAlchemy connectors
# ---------------------------------------------------------------------------


def gen_skeleton(p: ConnectorProfile, filename: str, purpose: str) -> str:
    """Generate a skeleton file that points the AI agent at CONNECTOR_CONTEXT.md."""
    return f'''{COPYRIGHT_HEADER}
"""
{p.camel} — {purpose}

This file is a skeleton. Implement it by following the instructions in:
    CONNECTOR_CONTEXT.md (in this directory)

Use the reference connector as a pattern:
    ingestion/src/metadata/ingestion/source/{p.service_type}/{REFERENCE_CONNECTORS.get(p.service_type, "mysql")}/{filename}
"""
# TODO: Implement this file. See CONNECTOR_CONTEXT.md for full instructions.
'''


# ---------------------------------------------------------------------------
# CONNECTOR_CONTEXT.md — the AI agent brief
# ---------------------------------------------------------------------------


ABSTRACT_METHODS = {
    "database": [],
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


def _get_base_info(p: ConnectorProfile):
    """Return (base_class, base_module, reference_connector, base_class_file)."""
    if p.service_type == "database" and p.connection_type != "sqlalchemy":
        base_class, base_module = DATABASE_NON_SQL_BASE
        ref = "salesforce"
        base_file = (
            "ingestion/src/metadata/ingestion/source/database/database_service.py"
        )
    else:
        base_class, base_module = BASE_CLASS_MAP[p.service_type]
        ref = REFERENCE_CONNECTORS.get(p.service_type, "mysql")
        base_file = BASE_CLASS_FILES.get(p.service_type, "")
    return base_class, base_module, ref, base_file


def generate_connector_context(p: ConnectorProfile, root: Path) -> str:
    """Generate the CONNECTOR_CONTEXT.md that any AI agent can read to implement the connector."""
    camel = p.camel
    base_class, base_module, ref, base_class_file = _get_base_info(p)

    source_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{p.name}"
    ref_dir = f"ingestion/src/metadata/ingestion/source/{p.service_type}/{ref}"
    svc_schema = f"openmetadata-spec/src/main/resources/json/schema/entity/services/{p.service_type}Service.json"
    conn_schema = f"openmetadata-spec/src/main/resources/json/schema/entity/services/connections/{p.service_type}/{p.module_name}Connection.json"
    test_conn = f"openmetadata-service/src/main/resources/json/data/testConnections/{p.service_type}/{p.module_name}.json"
    ui_utils = UI_UTILS_FILES.get(p.service_type, "")

    is_sqla = p.service_type == "database" and p.connection_type == "sqlalchemy"

    s = []
    s.append(f"# {camel} Connector — Implementation Brief")
    s.append("")
    s.append("## Instructions")
    s.append("")
    s.append("You are implementing a new OpenMetadata connector. This file contains")
    s.append("everything you need. Follow these steps in order:")
    s.append("")
    s.append("1. **Read the reference connector** to learn the patterns")
    s.append("2. **Implement the files** in the generated directory")
    s.append("3. **Register the connector** in the service schema and UI")
    s.append("4. **Run code generation** and formatting")
    s.append("5. **Write tests** and validate")
    s.append("")
    s.append("Do NOT guess patterns — copy them from the reference connector.")
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
    if p.docker_image:
        s.append(f"- **Docker Image**: `{p.docker_image}`")
    if p.docker_port:
        s.append(f"- **Docker Port**: {p.docker_port}")
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
        "Also read the base class to understand the topology and abstract methods:"
    )
    s.append(f"- `{base_class_file}`")
    s.append("")

    # --- Step 2: Implement ---
    s.append("## Step 2: Implement the Connector Files")
    s.append("")

    if is_sqla:
        s.append(
            "The scaffold generated concrete code templates for this SQLAlchemy connector."
        )
        s.append("Each file has `# TODO` markers showing what to implement.")
        s.append("")
        s.append(f"### `{source_dir}/connection.py`")
        s.append(
            "- `_get_client()` — Return a SQLAlchemy `Engine`. The default `create_generic_db_connection` works if the DB uses standard host/port/user/password. Customize for special auth (e.g., token injection)."
        )
        s.append(
            "- `test_connection()` — Usually works as-is with `test_connection_db_schema_sources`."
        )
        s.append("")
        s.append(f"### `{source_dir}/metadata.py`")
        s.append(
            "- Usually works as-is via `CommonDbSourceService`. Override only for custom behavior (stored procedures, custom type mapping)."
        )
        s.append("")
        s.append(f"### `{source_dir}/queries.py`")
        s.append("- Add SQL queries for metadata extraction or query log access.")
        s.append("")
        if "lineage" in p.capabilities:
            s.append(f"### `{source_dir}/lineage.py`")
            s.append(
                "- Set `filters` to SQL conditions that identify lineage-relevant queries."
            )
            s.append("")
            s.append(f"### `{source_dir}/query_parser.py`")
            s.append(
                "- Implement `get_sql_statement()` to return the SQL that fetches query logs."
            )
            s.append("")
        if "usage" in p.capabilities:
            s.append(f"### `{source_dir}/usage.py`")
            s.append(
                '- Usually just sets `filters = ""` to capture all queries for usage analysis.'
            )
            s.append("")
        s.append(f"### `{source_dir}/service_spec.py`")
        s.append("Already complete. No changes needed.")
        s.append("")
    else:
        s.append("The scaffold generated skeleton files. You must implement them by")
        s.append(f"following the patterns in the **{ref}** reference connector.")
        s.append("")

        if p.service_type == "database":
            s.append(f"### `{source_dir}/metadata.py`")
            s.append("")
            s.append(f"Extend `DatabaseServiceSource` (not CommonDbSourceService).")
            s.append(
                "Implement the database topology methods. See `salesforce/metadata.py` for the pattern:"
            )
            s.append("")
            s.append("- `get_database_names(self)` → yield database names")
            s.append("- `get_database_schema_names(self)` → yield schema names")
            s.append(
                "- `get_tables_name_and_type(self)` → yield (table_name, TableType) tuples"
            )
            s.append(
                "- `yield_table(self, table_name_and_type)` → build CreateTableRequest with columns"
            )
            s.append("")
            s.append(f"### `{source_dir}/service_spec.py`")
            s.append("")
            s.append(
                "Use `DefaultDatabaseSpec(metadata_source_class=YourSource)`. See `salesforce/service_spec.py`."
            )
            s.append("")
        else:
            s.append(f"### `{source_dir}/metadata.py`")
            s.append("")
            s.append(
                f"Extend `{base_class}`. You **must** implement these abstract methods:"
            )
            s.append("")
            methods = ABSTRACT_METHODS.get(p.service_type, [])
            for sig, ret, desc in methods:
                s.append(f"- `{sig}` -> `{ret}` — {desc}")
            s.append("")
            s.append(f"### `{source_dir}/service_spec.py`")
            s.append("")
            s.append(
                f"Use `BaseSpec(metadata_source_class=YourSource)`. See `{ref}/service_spec.py`."
            )
            s.append("")

        s.append(f"### `{source_dir}/client.py`")
        s.append("")
        s.append("Build the REST/SDK client. Required methods:")
        s.append("")
        s.append(
            "- `__init__(self, config)` — Initialize HTTP session or SDK client, set up auth"
        )
        s.append(
            "- `test_access(self)` — Make a lightweight API call to verify credentials"
        )
        s.append("")

        s.append(f"### `{source_dir}/connection.py`")
        s.append("")
        s.append("Implement `get_connection()` and `test_connection()` functions.")
        s.append(f"The `test_fn` dict keys must match the step names in `{test_conn}`.")
        s.append("")

    # --- Optional capability overrides for non-database ---
    if p.service_type == "dashboard":
        s.append("### Optional Capability Overrides (in `metadata.py`)")
        s.append("")
        s.append("These are **not required** but can be implemented by overriding the")
        s.append("default no-op methods in the base class:")
        s.append("")
        s.append("- `yield_dashboard_lineage_details()` — Dashboard-to-table lineage")
        s.append("- `yield_dashboard_usage()` — Dashboard view counts")
        s.append("- `yield_bulk_datamodel()` — Data models (LookML views, etc.)")
        s.append("- `get_owner_ref()` — Dashboard ownership")
        s.append("- `get_project_name()` — Folder/project/workspace name")
        s.append("")
    elif p.service_type == "pipeline":
        s.append("### Optional Capability Overrides (in `metadata.py`)")
        s.append("")
        s.append("- `yield_pipeline_lineage_details()` — Pipeline-to-table lineage")
        s.append("")

    # --- Step 3: Register ---
    s.append("## Step 3: Register the Connector")
    s.append("")
    s.append("Modify these existing files:")
    s.append("")
    s.append(f"### 3a. Service schema: `{svc_schema}`")
    s.append("")
    s.append(f'- Add `"{camel}"` to the `{p.service_type}ServiceType` enum array')
    s.append("- Add to the connection `oneOf` array:")
    s.append("  ```json")
    s.append(
        f'  {{"$ref": "connections/{p.service_type}/{p.module_name}Connection.json"}}'
    )
    s.append("  ```")
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
    s.append("```bash")
    s.append("source env/bin/activate")
    s.append(
        "make generate                                # Python models from JSON Schema"
    )
    s.append("mvn clean install -pl openmetadata-spec      # Java models")
    s.append(
        "cd openmetadata-ui/src/main/resources/ui && yarn parse-schema  # UI forms"
    )
    s.append("make py_format                               # Format Python code")
    s.append("mvn spotless:apply                           # Format Java code")
    s.append("```")
    s.append("")

    # --- Step 5: Tests ---
    s.append("## Step 5: Write Tests and Validate")
    s.append("")
    s.append("Write tests following the patterns in existing connectors:")
    s.append("")

    unit_ref = f"ingestion/tests/unit/topology/{p.service_type}/"
    s.append(f"### Unit tests")
    s.append(f"- **Reference directory**: `{unit_ref}`")
    s.append(
        f"- **Create**: `ingestion/tests/unit/topology/{p.service_type}/test_{p.name}.py`"
    )
    s.append(
        "- Pattern: mock config dict, patch `test_connection`/`get_connection`, create source, test methods"
    )
    s.append("")

    if p.docker_image:
        s.append("### Integration tests")
        s.append(f"- **Docker image**: `{p.docker_image}`")
        if p.docker_port:
            s.append(f"- **Container port**: {p.docker_port}")
        s.append(
            "- **Reference**: `ingestion/tests/integration/mysql/conftest.py` (database) or "
            "`ingestion/tests/integration/metabase/conftest.py` (non-database)"
        )
        s.append(
            f"- Use `testcontainers` to spin up `{p.docker_image}`, create sample data, run ingestion"
        )
        s.append("")

    s.append("### Validate")
    s.append("")
    s.append("```bash")
    s.append("source env/bin/activate")
    s.append(
        f"python -m pytest ingestion/tests/unit/topology/{p.service_type}/test_{p.name}.py -v"
    )
    s.append("```")
    s.append("")

    # --- Step 6: Validate checklist ---
    s.append("## Checklist")
    s.append("")
    s.append("- [ ] `make generate` succeeds")
    s.append("- [ ] `mvn clean install -pl openmetadata-spec` succeeds")
    s.append("- [ ] `yarn parse-schema` succeeds")
    s.append("- [ ] Unit tests pass")
    s.append("- [ ] `make py_format` passes")
    s.append("- [ ] `mvn spotless:apply` passes")
    s.append("")

    # --- Generated files index ---
    s.append("## Generated Files")
    s.append("")
    s.append("| File | Status |")
    s.append("|------|--------|")
    s.append(f"| `{conn_schema}` | Complete — connection JSON Schema |")
    s.append(f"| `{test_conn}` | Complete — test connection steps |")
    if is_sqla:
        s.append(f"| `{source_dir}/connection.py` | Template — has TODOs |")
        s.append(f"| `{source_dir}/metadata.py` | Template — usually works as-is |")
        s.append(f"| `{source_dir}/service_spec.py` | Complete |")
        s.append(f"| `{source_dir}/queries.py` | Template — has TODOs |")
        if "lineage" in p.capabilities:
            s.append(f"| `{source_dir}/lineage.py` | Template — has TODOs |")
            s.append(f"| `{source_dir}/query_parser.py` | Template — has TODOs |")
        if "usage" in p.capabilities:
            s.append(f"| `{source_dir}/usage.py` | Template — has TODOs |")
    else:
        s.append(
            f"| `{source_dir}/connection.py` | **Skeleton** — implement from reference |"
        )
        s.append(
            f"| `{source_dir}/metadata.py` | **Skeleton** — implement from reference |"
        )
        s.append(
            f"| `{source_dir}/service_spec.py` | **Skeleton** — implement from reference |"
        )
        s.append(
            f"| `{source_dir}/client.py` | **Skeleton** — implement from reference |"
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
    raise RuntimeError(
        "Could not find repository root (no 'openmetadata-spec' directory found)"
    )


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

    is_sqla = p.service_type == "database" and p.connection_type == "sqlalchemy"

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

    if is_sqla:
        # SQLAlchemy database connectors get concrete templates
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
        # All other connector types get skeleton files
        write_file(
            source_dir / "connection.py",
            gen_skeleton(p, "connection.py", "connection handler"),
        )
        write_file(
            source_dir / "metadata.py",
            gen_skeleton(p, "metadata.py", "source class"),
        )
        write_file(
            source_dir / "service_spec.py",
            gen_skeleton(p, "service_spec.py", "ServiceSpec registration"),
        )
        write_file(
            source_dir / "client.py",
            gen_skeleton(p, "client.py", "REST/SDK client"),
        )

    # 4. CONNECTOR_CONTEXT.md — the AI agent brief
    context_md = generate_connector_context(p, root)
    write_file(source_dir / "CONNECTOR_CONTEXT.md", context_md)

    # 5. Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("  Scaffold complete!")
    logger.info("=" * 60)
    logger.info("")
    logger.info("  Generated:")
    logger.info("    - Connection JSON Schema")
    logger.info("    - Test connection JSON")
    logger.info(
        f"    - {'Concrete code templates' if is_sqla else 'Skeleton files'} in {source_dir.relative_to(root)}"
    )
    logger.info("    - CONNECTOR_CONTEXT.md (AI agent implementation brief)")
    logger.info("")
    logger.info("  Next steps:")
    logger.info(f"  1. Read {source_dir.relative_to(root)}/CONNECTOR_CONTEXT.md")
    if is_sqla:
        logger.info("  2. Implement the TODO items in the generated files")
    else:
        logger.info("  2. Implement the connector files (use the reference connector)")
    logger.info("  3. Register the connector (see CONNECTOR_CONTEXT.md Step 3)")
    logger.info("  4. Run code generation + formatting")
    logger.info("  5. Write tests and validate")
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

    if profile.service_type != "database" and profile.connection_type == "sqlalchemy":
        logger.error(
            "--connection-type sqlalchemy is only valid for database service type."
        )
        sys.exit(1)

    run_scaffold(profile)
