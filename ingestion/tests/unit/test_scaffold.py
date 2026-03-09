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
Tests for the connector scaffold CLI tool.
"""
import argparse
import json
from unittest.mock import patch

import pytest

from metadata.cli.scaffold import (
    AUTH_CHOICES,
    CAPABILITY_CHOICES,
    CONNECTION_TYPES,
    REFERENCE_CONNECTORS,
    SERVICE_TYPES,
    ConnectorProfile,
    _build_auth_refs,
    _has_ref_auth,
    _has_token_auth,
    _prompt,
    _prompt_multi,
    _prompt_multiline,
    _prompt_optional,
    generate_connection_schema,
    generate_test_connection_json,
    get_repo_root,
    run_scaffold_cli,
)

# ---------------------------------------------------------------------------
# ConnectorProfile
# ---------------------------------------------------------------------------


class TestConnectorProfile:
    def test_camel_single_word(self):
        p = ConnectorProfile()
        p.name = "mysql"
        assert p.camel == "Mysql"

    def test_camel_multi_word(self):
        p = ConnectorProfile()
        p.name = "big_query"
        assert p.camel == "BigQuery"

    def test_camel_three_words(self):
        p = ConnectorProfile()
        p.name = "azure_data_lake"
        assert p.camel == "AzureDataLake"

    def test_module_name_single_word(self):
        p = ConnectorProfile()
        p.name = "mysql"
        assert p.module_name == "mysql"

    def test_module_name_multi_word(self):
        p = ConnectorProfile()
        p.name = "big_query"
        assert p.module_name == "bigQuery"

    def test_module_name_three_words(self):
        p = ConnectorProfile()
        p.name = "qlik_cloud"
        assert p.module_name == "qlikCloud"

    def test_defaults(self):
        p = ConnectorProfile()
        assert p.name == ""
        assert p.service_type == ""
        assert p.connection_type == "rest_api"
        assert p.auth_types == ["basic"]
        assert p.capabilities == ["metadata"]
        assert p.scheme is None
        assert p.default_port is None


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


class TestAuthHelpers:
    def test_build_auth_refs_basic(self):
        refs = _build_auth_refs(["basic"])
        assert refs == [{"$ref": "./common/basicAuth.json"}]

    def test_build_auth_refs_multiple(self):
        refs = _build_auth_refs(["basic", "iam"])
        assert len(refs) == 2
        assert refs[0]["$ref"] == "./common/basicAuth.json"
        assert refs[1]["$ref"] == "./common/iamAuthConfig.json"

    def test_build_auth_refs_ignores_token(self):
        refs = _build_auth_refs(["token", "oauth"])
        assert refs == []

    def test_build_auth_refs_mixed(self):
        refs = _build_auth_refs(["jwt", "token"])
        assert len(refs) == 1
        assert refs[0]["$ref"] == "./common/jwtAuth.json"

    def test_has_ref_auth_true(self):
        assert _has_ref_auth(["basic"]) is True
        assert _has_ref_auth(["iam", "token"]) is True

    def test_has_ref_auth_false(self):
        assert _has_ref_auth(["token"]) is False
        assert _has_ref_auth(["oauth"]) is False
        assert _has_ref_auth([]) is False

    def test_has_token_auth_true(self):
        assert _has_token_auth(["token"]) is True
        assert _has_token_auth(["oauth"]) is True
        assert _has_token_auth(["basic", "token"]) is True

    def test_has_token_auth_false(self):
        assert _has_token_auth(["basic"]) is False
        assert _has_token_auth([]) is False


# ---------------------------------------------------------------------------
# generate_connection_schema
# ---------------------------------------------------------------------------


class TestGenerateConnectionSchema:
    @staticmethod
    def _make_profile(
        name="test_db",
        service_type="database",
        connection_type="sqlalchemy",
        scheme="testdb+pytest",
        auth_types=None,
        capabilities=None,
        description="",
    ) -> ConnectorProfile:
        p = ConnectorProfile()
        p.name = name
        p.service_type = service_type
        p.connection_type = connection_type
        p.scheme = scheme
        p.auth_types = auth_types or ["basic"]
        p.capabilities = capabilities or ["metadata"]
        p.description = description
        return p

    def test_schema_structure(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)

        assert schema["$schema"] == "http://json-schema.org/draft-07/schema#"
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
        assert "definitions" in schema
        assert "properties" in schema

    def test_schema_ids(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)

        assert "testDbConnection" in schema["$id"]
        assert "database" in schema["$id"]
        assert schema["title"] == "TestDbConnection"
        assert "TestDbConnection" in schema["javaType"]

    def test_schema_type_definition(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)

        assert "testDbType" in schema["definitions"]
        type_def = schema["definitions"]["testDbType"]
        assert type_def["enum"] == ["TestDb"]
        assert type_def["default"] == "TestDb"

    def test_database_sqlalchemy_has_scheme(self):
        p = self._make_profile(scheme="testdb+pytest")
        schema = generate_connection_schema(p)

        assert "scheme" in schema["properties"]
        assert "testDbScheme" in schema["definitions"]
        scheme_def = schema["definitions"]["testDbScheme"]
        assert "testdb+pytest" in scheme_def["enum"]

    def test_database_sqlalchemy_has_host_port(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)

        assert "hostPort" in schema["properties"]
        assert "hostPort" in schema["required"]

    def test_database_sqlalchemy_has_database_fields(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)

        assert "databaseName" in schema["properties"]
        assert "databaseSchema" in schema["properties"]

    def test_database_sqlalchemy_basic_auth(self):
        p = self._make_profile(auth_types=["basic"])
        schema = generate_connection_schema(p)

        assert "username" in schema["properties"]
        assert "authType" in schema["properties"]
        assert "username" in schema["required"]

    def test_database_sqlalchemy_token_auth(self):
        p = self._make_profile(auth_types=["token"])
        schema = generate_connection_schema(p)

        assert "token" in schema["properties"]
        assert "authType" not in schema["properties"]

    def test_database_sqlalchemy_with_lineage_caps(self):
        p = self._make_profile(capabilities=["metadata", "lineage"])
        schema = generate_connection_schema(p)

        props = schema["properties"]
        assert "supportsMetadataExtraction" in props
        assert "supportsLineageExtraction" in props

    def test_database_sqlalchemy_with_profiler_caps(self):
        p = self._make_profile(capabilities=["metadata", "profiler"])
        schema = generate_connection_schema(p)

        assert "supportsProfiler" in schema["properties"]

    def test_schema_is_valid_json(self):
        p = self._make_profile()
        schema = generate_connection_schema(p)
        serialized = json.dumps(schema, indent=2)
        reparsed = json.loads(serialized)
        assert reparsed == schema

    def test_database_non_sqlalchemy_host_port_required(self):
        p = self._make_profile(
            name="test_rest_db",
            service_type="database",
            connection_type="rest_api",
            scheme=None,
        )
        schema = generate_connection_schema(p)

        assert "hostPort" in schema["properties"]
        assert "hostPort" in schema["required"]

    def test_dashboard_schema(self):
        p = self._make_profile(
            name="my_dash",
            service_type="dashboard",
            connection_type="rest_api",
            scheme=None,
        )
        schema = generate_connection_schema(p)

        assert "dashboard" in schema["$id"]
        assert "hostPort" in schema["properties"]
        assert "hostPort" in schema["required"]
        assert "supportsMetadataExtraction" in schema["properties"]

    def test_pipeline_schema(self):
        p = self._make_profile(
            name="my_pipe",
            service_type="pipeline",
            connection_type="rest_api",
            scheme=None,
        )
        schema = generate_connection_schema(p)

        assert "pipeline" in schema["$id"]
        assert "hostPort" in schema["properties"]

    def test_messaging_schema(self):
        p = self._make_profile(
            name="my_queue",
            service_type="messaging",
            connection_type="rest_api",
            scheme=None,
        )
        schema = generate_connection_schema(p)

        assert "messaging" in schema["$id"]
        assert "bootstrapServers" in schema["properties"]

    def test_custom_description(self):
        p = self._make_profile(description="My custom database connector")
        schema = generate_connection_schema(p)
        assert schema["description"] == "My custom database connector"

    def test_default_description(self):
        p = self._make_profile(description="")
        schema = generate_connection_schema(p)
        assert schema["description"] == "TestDb Connection Config"


# ---------------------------------------------------------------------------
# generate_test_connection_json
# ---------------------------------------------------------------------------


class TestGenerateTestConnectionJson:
    @staticmethod
    def _make_profile(
        name="test_db", service_type="database", capabilities=None
    ) -> ConnectorProfile:
        p = ConnectorProfile()
        p.name = name
        p.service_type = service_type
        p.capabilities = capabilities or ["metadata"]
        return p

    def test_database_steps(self):
        p = self._make_profile()
        result = generate_test_connection_json(p)

        assert result["name"] == "TestDb"
        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetSchemas" in step_names
        assert "GetTables" in step_names
        assert "GetViews" in step_names

    def test_database_check_access_is_mandatory_and_short_circuit(self):
        p = self._make_profile()
        result = generate_test_connection_json(p)

        check_access = result["steps"][0]
        assert check_access["name"] == "CheckAccess"
        assert check_access["mandatory"] is True
        assert check_access["shortCircuit"] is True

    def test_database_with_lineage_has_get_queries(self):
        p = self._make_profile(capabilities=["metadata", "lineage"])
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "GetQueries" in step_names

    def test_database_with_usage_has_get_queries(self):
        p = self._make_profile(capabilities=["metadata", "usage"])
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "GetQueries" in step_names

    def test_database_without_lineage_usage_no_get_queries(self):
        p = self._make_profile(capabilities=["metadata"])
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "GetQueries" not in step_names

    def test_dashboard_steps(self):
        p = self._make_profile(name="my_dash", service_type="dashboard")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetDashboards" in step_names
        assert "GetCharts" in step_names
        assert "GetSchemas" not in step_names

    def test_pipeline_steps(self):
        p = self._make_profile(name="my_pipe", service_type="pipeline")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetPipelines" in step_names

    def test_messaging_steps(self):
        p = self._make_profile(name="my_queue", service_type="messaging")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetTopics" in step_names

    def test_storage_steps(self):
        p = self._make_profile(name="my_store", service_type="storage")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetContainers" in step_names

    def test_search_steps(self):
        p = self._make_profile(name="my_search", service_type="search")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetSearchIndexes" in step_names

    def test_api_steps(self):
        p = self._make_profile(name="my_api", service_type="api")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetCollections" in step_names

    def test_mlmodel_steps(self):
        p = self._make_profile(name="my_ml", service_type="mlmodel")
        result = generate_test_connection_json(p)

        step_names = [s["name"] for s in result["steps"]]
        assert "CheckAccess" in step_names
        assert "GetModels" in step_names


# ---------------------------------------------------------------------------
# Interactive prompts — EOF/interrupt handling
# ---------------------------------------------------------------------------


class TestPromptEofHandling:
    def test_prompt_multiline_eof_returns_partial(self):
        with patch("builtins.input", side_effect=["line1", "line2", EOFError]):
            result = _prompt_multiline("Test")
        assert result == "line1\nline2"

    def test_prompt_multiline_keyboard_interrupt(self):
        with patch("builtins.input", side_effect=[KeyboardInterrupt]):
            result = _prompt_multiline("Test")
        assert result == ""

    def test_prompt_multiline_empty_line_stops(self):
        with patch("builtins.input", side_effect=["hello", ""]):
            result = _prompt_multiline("Test")
        assert result == "hello"

    def test_prompt_eof_with_default(self):
        with patch("builtins.input", side_effect=EOFError):
            result = _prompt("Test", default="fallback")
        assert result == "fallback"

    def test_prompt_eof_without_default_exits(self):
        with patch("builtins.input", side_effect=EOFError):
            with pytest.raises(SystemExit):
                _prompt("Test")

    def test_prompt_keyboard_interrupt_with_default(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            result = _prompt("Test", default="fallback")
        assert result == "fallback"

    def test_prompt_keyboard_interrupt_without_default_exits(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            with pytest.raises(SystemExit):
                _prompt("Test")

    def test_prompt_multi_eof_with_defaults(self):
        with patch("builtins.input", side_effect=EOFError):
            result = _prompt_multi("Test", ["a", "b"], defaults=["a"])
        assert result == ["a"]

    def test_prompt_multi_eof_without_defaults_exits(self):
        with patch("builtins.input", side_effect=EOFError):
            with pytest.raises(SystemExit):
                _prompt_multi("Test", ["a", "b"])

    def test_prompt_optional_eof_returns_empty(self):
        with patch("builtins.input", side_effect=EOFError):
            result = _prompt_optional("Test")
        assert result == ""

    def test_prompt_optional_keyboard_interrupt_returns_empty(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            result = _prompt_optional("Test")
        assert result == ""


# ---------------------------------------------------------------------------
# run_scaffold_cli — name validation
# ---------------------------------------------------------------------------


class TestRunScaffoldCliValidation:
    @staticmethod
    def _make_args(**kwargs) -> argparse.Namespace:
        defaults = {
            "name": "my_connector",
            "service_type": "database",
            "connection_type": "sqlalchemy",
            "scheme": "mydb+pymydb",
            "default_port": 5432,
            "auth_types": ["basic"],
            "capabilities": ["metadata"],
            "display_name": None,
            "description": None,
            "docs_url": None,
            "sdk_package": None,
            "api_endpoints": None,
            "docs_notes": None,
            "docker_image": None,
            "docker_port": None,
        }
        defaults.update(kwargs)
        return argparse.Namespace(**defaults)

    def test_rejects_uppercase_name(self):
        args = self._make_args(name="MyConnector")
        with pytest.raises(SystemExit):
            run_scaffold_cli(args)

    def test_rejects_name_starting_with_number(self):
        args = self._make_args(name="1bad_name")
        with pytest.raises(SystemExit):
            run_scaffold_cli(args)

    def test_rejects_name_with_dashes(self):
        args = self._make_args(name="my-connector")
        with pytest.raises(SystemExit):
            run_scaffold_cli(args)

    def test_rejects_name_with_spaces(self):
        args = self._make_args(name="my connector")
        with pytest.raises(SystemExit):
            run_scaffold_cli(args)

    def test_rejects_sqlalchemy_for_non_database(self):
        args = self._make_args(
            name="my_dash",
            service_type="dashboard",
            connection_type="sqlalchemy",
        )
        with pytest.raises(SystemExit):
            run_scaffold_cli(args)

    def test_allows_rest_api_for_non_database(self):
        args = self._make_args(
            name="my_dash",
            service_type="dashboard",
            connection_type="rest_api",
        )
        # Passes validation, then proceeds to run_scaffold (which writes files).
        # We just verify it doesn't exit during validation.
        with patch("metadata.cli.scaffold.run_scaffold"):
            run_scaffold_cli(args)


# ---------------------------------------------------------------------------
# get_repo_root
# ---------------------------------------------------------------------------


class TestGetRepoRoot:
    def test_finds_repo_root(self):
        root = get_repo_root()
        assert (root / "openmetadata-spec").is_dir()
        assert (root / "ingestion").is_dir()

    def test_returns_path_object(self):
        root = get_repo_root()
        from pathlib import Path

        assert isinstance(root, Path)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    def test_service_types_complete(self):
        expected = {
            "database",
            "dashboard",
            "pipeline",
            "messaging",
            "mlmodel",
            "storage",
            "search",
            "api",
        }
        assert set(SERVICE_TYPES) == expected

    def test_connection_types(self):
        assert "sqlalchemy" in CONNECTION_TYPES
        assert "rest_api" in CONNECTION_TYPES
        assert "sdk_client" in CONNECTION_TYPES

    def test_auth_choices(self):
        assert "basic" in AUTH_CHOICES
        assert "token" in AUTH_CHOICES
        assert "oauth" in AUTH_CHOICES

    def test_capability_choices(self):
        assert "metadata" in CAPABILITY_CHOICES
        assert "lineage" in CAPABILITY_CHOICES
        assert "profiler" in CAPABILITY_CHOICES

    def test_reference_connectors_cover_all_service_types(self):
        for st in SERVICE_TYPES:
            assert st in REFERENCE_CONNECTORS
