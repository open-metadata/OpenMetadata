"""
Test DBT Ingestion CLI module
"""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from metadata.cli.ingest_dbt import (
    FilterPattern,
    OpenMetadataDBTConfig,
    create_dbt_workflow_config,
    extract_openmetadata_config,
    find_dbt_project_config,
    run_ingest_dbt,
    substitute_env_vars,
)

MOCK_ENVIRONMENT_VARIABLES = {
    "OPENMETADATA_HOST_PORT": "http://test-server:port/endpoint",
    "OPENMETADATA_JWT_TOKEN": "test-jwt-token",
    "OPENMETADATA_SERVICE_NAME": "test_service",
}


class DbtIngestCLIUnitTest(unittest.TestCase):
    """Test cases for DBT Ingestion CLI functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_resources_path = Path(__file__).parent / "resources" / "dbt_ingest"
        for var, value in MOCK_ENVIRONMENT_VARIABLES.items():
            os.environ[var] = value

    def tearDown(self):
        """Clean up after tests"""
        for var in MOCK_ENVIRONMENT_VARIABLES:
            os.environ.pop(var, None)

    def test_filter_pattern_model(self):
        """Test FilterPattern Pydantic model"""
        # Test with defaults
        pattern = FilterPattern()
        self.assertEqual(pattern.includes, [".*"])
        self.assertIsNone(pattern.excludes)

        # Test with custom values
        pattern = FilterPattern(includes=["table1"], excludes=["temp_*"])
        self.assertEqual(pattern.includes, ["table1"])
        self.assertEqual(pattern.excludes, ["temp_*"])

    def test_environment_variable_substitution(self):
        """Test all environment variable substitution patterns and integration"""

        # Test all three substitution patterns together
        content = """
        name: 'test_project'
        version: '1.0.0'
        vars:
        openmetadata_host_port: "${OPENMETADATA_HOST_PORT}"
        openmetadata_jwt_token: "{{ env_var('OPENMETADATA_JWT_TOKEN') }}"
        openmetadata_service_name: '{{ env_var("OPENMETADATA_SERVICE_NAME") }}'
        fallback_setting: "{{ env_var('UNSET_VAR', 'default-value') }}"
        """

        # Test substitution function directly
        result = substitute_env_vars(content)
        self.assertIn("http://test-server:port/endpoint", result)
        self.assertIn("test-jwt-token", result)
        self.assertIn("test_service", result)
        self.assertIn("default-value", result)
        self.assertNotIn("${OPENMETADATA_HOST_PORT", result)
        self.assertNotIn("env_var('OPENMETADATA_JWT_TOKEN')", result)
        self.assertNotIn("env_var('OPENMETADATA_SERVICE_NAME')", result)
        self.assertNotIn("env_var('UNSET_VAR', 'default-value')", result)

        # Test error cases
        error_content = 'vars:\n  host: "${MISSING_VAR}"'
        with self.assertRaises(ValueError) as context:
            substitute_env_vars(error_content)
        self.assertIn("MISSING_VAR", str(context.exception))

        error_content2 = "vars:\n  host: \"{{ env_var('MISSING_DBT_VAR') }}\""
        with self.assertRaises(ValueError) as context:
            substitute_env_vars(error_content2)
        self.assertIn("MISSING_DBT_VAR", str(context.exception))

    def test_dotenv_file_support(self):
        """Test that .env files are properly loaded"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Create .env file
            env_file = temp_path / ".env"
            env_file.write_text(
                """
DOTENV_HOST=http://dotenv-host:8585/endpoint
DOTENV_TOKEN=dotenv-jwt-token
DOTENV_SERVICE=dotenv-service
"""
            )

            # Create dbt_project.yml that uses .env variables
            dbt_project_file = temp_path / "dbt_project.yml"
            dbt_project_content = """
name: 'test_dotenv_project'
version: '1.0.0'
vars:
  openmetadata_host_port: "${DOTENV_HOST}"
  openmetadata_jwt_token: "{{ env_var('DOTENV_TOKEN') }}"
  openmetadata_service_name: "{{ env_var('DOTENV_SERVICE') }}"
"""
            dbt_project_file.write_text(dbt_project_content)

            # Load and validate the configuration
            config = find_dbt_project_config(temp_path)
            vars_section = config["vars"]

            self.assertEqual(
                vars_section["openmetadata_host_port"],
                "http://dotenv-host:8585/endpoint",
            )
            self.assertEqual(vars_section["openmetadata_jwt_token"], "dotenv-jwt-token")
            self.assertEqual(
                vars_section["openmetadata_service_name"], "dotenv-service"
            )

            # Test OpenMetadata config extraction
            om_config = extract_openmetadata_config(config)
            self.assertEqual(
                om_config.openmetadata_host_port, "http://dotenv-host:8585/endpoint"
            )
            self.assertEqual(om_config.openmetadata_jwt_token, "dotenv-jwt-token")
            self.assertEqual(om_config.openmetadata_service_name, "dotenv-service")

    def test_dbt_project_config_vars_validation(self):
        """Test dbt_project.yml vars section validation and structure"""
        # Test successful loading and vars validation
        config = find_dbt_project_config(self.test_resources_path)

        # Validate basic structure
        self.assertIsInstance(config, dict)
        self.assertEqual(config["name"], "jaffle_shop")
        self.assertEqual(config["version"], "1.0.0")
        self.assertIn("vars", config)

        # Validate vars section structure and required OpenMetadata variables
        vars_section = config["vars"]
        self.assertIsInstance(vars_section, dict)

        # Validate all required OpenMetadata variables exist
        required_om_vars = [
            "openmetadata_host_port",
            "openmetadata_jwt_token",
            "openmetadata_service_name",
        ]

        for var_name in required_om_vars:
            self.assertIn(
                var_name, vars_section, f"Missing required variable: {var_name}"
            )
            self.assertIsNotNone(
                vars_section[var_name], f"Variable {var_name} should not be None"
            )
            self.assertNotEqual(
                vars_section[var_name].strip(),
                "",
                f"Variable {var_name} should not be empty",
            )

        # Validate specific values match expected test configuration
        self.assertEqual(
            vars_section["openmetadata_host_port"], "http://test-server:port/endpoint"
        )
        # Get the expected JWT token from environment variable (same as what gets substituted)
        expected_jwt_token = os.environ.get("OPENMETADATA_JWT_TOKEN")
        self.assertEqual(vars_section["openmetadata_jwt_token"], expected_jwt_token)
        self.assertEqual(vars_section["openmetadata_service_name"], "test_service")

        # Test file not found error
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(FileNotFoundError) as context:
                find_dbt_project_config(Path(temp_dir))
            self.assertIn("dbt_project.yml not found", str(context.exception))

    def test_openmetadata_config_extraction_with_defaults(self):
        """Test OpenMetadata configuration extraction with default values"""
        # Test with only required variables (should use defaults for optional ones)
        minimal_config = {
            "vars": {
                "openmetadata_host_port": "http://test-server:port/endpoint",
                "openmetadata_jwt_token": "test-jwt-token",
                "openmetadata_service_name": "test_service",
            }
        }
        om_config = extract_openmetadata_config(minimal_config)

        # Validate required config
        self.assertIsInstance(om_config, OpenMetadataDBTConfig)
        self.assertEqual(
            om_config.openmetadata_host_port, "http://test-server:port/endpoint"
        )
        self.assertEqual(om_config.openmetadata_jwt_token, "test-jwt-token")
        self.assertEqual(om_config.openmetadata_service_name, "test_service")

        # Validate defaults for optional config
        self.assertTrue(om_config.openmetadata_dbt_update_descriptions)
        self.assertTrue(om_config.openmetadata_dbt_update_owners)
        self.assertTrue(om_config.openmetadata_include_tags)
        self.assertFalse(om_config.openmetadata_search_across_databases)
        self.assertIsNone(om_config.openmetadata_dbt_classification_name)

        # Validate default filter patterns (should be defaults when not specified)
        self.assertEqual(om_config.database_filter.includes, [".*"])
        self.assertEqual(om_config.schema_filter.includes, [".*"])
        self.assertEqual(om_config.table_filter.includes, [".*"])

    def test_openmetadata_config_extraction_with_custom_values(self):
        """Test OpenMetadata configuration extraction with custom values"""
        # Test with custom optional variables using dict format only
        custom_config = {
            "vars": {
                "openmetadata_host_port": "http://test-server:port/endpoint",
                "openmetadata_jwt_token": "test-jwt-token",
                "openmetadata_service_name": "test_service",
                "openmetadata_dbt_update_descriptions": False,
                "openmetadata_dbt_update_owners": False,
                "openmetadata_include_tags": False,
                "openmetadata_search_across_databases": True,
                "openmetadata_dbt_classification_name": "custom_tags",
                "openmetadata_database_filter_pattern": {
                    "includes": ["prod_*", "staging_*"]
                },
                "openmetadata_schema_filter_pattern": {
                    "includes": ["public"],
                    "excludes": ["temp_*"],
                },
                "openmetadata_table_filter_pattern": {"includes": ["fact_*"]},
            }
        }
        om_config = extract_openmetadata_config(custom_config)

        # Validate custom config values
        self.assertFalse(om_config.openmetadata_dbt_update_descriptions)
        self.assertFalse(om_config.openmetadata_dbt_update_owners)
        self.assertFalse(om_config.openmetadata_include_tags)
        self.assertTrue(om_config.openmetadata_search_across_databases)
        self.assertEqual(om_config.openmetadata_dbt_classification_name, "custom_tags")

        # Validate custom filter patterns
        self.assertEqual(om_config.database_filter.includes, ["prod_*", "staging_*"])
        self.assertEqual(om_config.schema_filter.includes, ["public"])
        self.assertEqual(om_config.schema_filter.excludes, ["temp_*"])
        self.assertEqual(om_config.table_filter.includes, ["fact_*"])

    def test_openmetadata_config_validation_errors(self):
        """Test Pydantic validation errors for invalid configurations"""
        # Test missing required field
        with self.assertRaises(ValueError) as context:
            extract_openmetadata_config(
                {"vars": {"openmetadata_host_port": "http://test"}}
            )
        self.assertIn("Field required", str(context.exception))

    def test_url_validation_comprehensive(self):
        """Test comprehensive URL validation scenarios including valid and invalid URLs"""

        # Test valid URLs - should all pass (based on URL class behavior)
        valid_urls = [
            "http://localhost:8585",
            "https://openmetadata.example.com:8585",
            "http://192.168.1.100:8585/api",
            "https://my-openmetadata-server.com/api",
            "ws://localhost:8585",
            "wss://secure-websocket.example.com:8585",
            "http://127.0.0.1:8585",
            "https://openmetadata-prod.company.com:443/api/v1",
            # URL class accepts these edge cases
            "http://",
            "https://",
            "http:///",
            "ws://",
            "wss://",
            "http://localhost:8585 with spaces",  # URL class is permissive
            "http://local<host>:8585",  # URL class allows special chars
            "http://localhost:8585\nwith\nnewlines",  # URL class even accepts newlines
        ]

        print(f"\nTesting {len(valid_urls)} valid URLs:")
        for url in valid_urls:
            with self.subTest(url=url):
                try:
                    config = OpenMetadataDBTConfig(
                        openmetadata_host_port=url,
                        openmetadata_jwt_token="test-jwt-token",
                        openmetadata_service_name="test_service",
                    )
                    print(f"✅ {url!r} - VALID")
                except Exception as e:
                    self.fail(f"Valid URL {url!r} was rejected: {e}")

        # Test invalid URLs - should all fail based on URL class behavior
        invalid_urls = [
            # Missing protocol entirely
            "localhost:8585",
            "openmetadata.example.com:8585",
            "192.168.1.100:8585",
            # Invalid protocols (not http*, https*, ws*, wss*)
            "ftp://localhost:8585",
            "file:///path/to/file",
            "sftp://server.com:22",
            "ssh://server.com:22",
            "tcp://localhost:8585",
            "smtp://mail.server.com:25",
            "mysql://localhost:3306/db",
            # Malformed URLs
            "invalid-url",
            "not_a_url_at_all",
            "://localhost:8585",  # missing protocol
            "htp://localhost:8585",  # typo in protocol
            "http:/localhost:8585",  # missing slash
            # Empty and whitespace
            "",
            "   ",
            "\n",
            "\t",
            # Completely invalid formats
            "just some random text",
            "12345",
        ]

        print(f"\nTesting {len(invalid_urls)} invalid URLs:")
        for url in invalid_urls:
            with self.subTest(url=url):
                with self.assertRaises(
                    ValueError, msg=f"Invalid URL {repr(url)} should have been rejected"
                ):
                    OpenMetadataDBTConfig(
                        openmetadata_host_port=url,
                        openmetadata_jwt_token="test-jwt-token",
                        openmetadata_service_name="test_service",
                    )
                print(f"✅ {repr(url)} - CORRECTLY REJECTED")

        # Test edge cases with None and non-string types
        edge_cases = [
            None,
            123,
            [],
            {},
            True,
            False,
        ]

        print(f"\nTesting {len(edge_cases)} edge cases:")
        for case in edge_cases:
            with self.subTest(case=case):
                with self.assertRaises(
                    (ValueError, TypeError),
                    msg=f"Edge case {repr(case)} should have been rejected",
                ):
                    OpenMetadataDBTConfig(
                        openmetadata_host_port=case,
                        openmetadata_jwt_token="test-jwt-token",
                        openmetadata_service_name="test_service",
                    )
                print(f"✅ {repr(case)} - CORRECTLY REJECTED")

    def test_dbt_project_yml_vars_format_validation(self):
        """Test that dbt_project.yml vars follow correct format and naming convention"""
        config = find_dbt_project_config(self.test_resources_path)
        vars_section = config["vars"]

        # Test that we only use standard OpenMetadata naming
        standard_vars = [
            var for var in vars_section.keys() if var.startswith("openmetadata_")
        ]
        self.assertGreaterEqual(
            len(standard_vars),
            3,
            "Should have at least 3 required OpenMetadata variables",
        )

        # Test that the configuration can be successfully parsed
        om_config = extract_openmetadata_config(config)
        self.assertIsInstance(om_config, OpenMetadataDBTConfig)

        # Validate URL format
        self.assertTrue(
            om_config.openmetadata_host_port.startswith("http://")
            or om_config.openmetadata_host_port.startswith("https://"),
            "Host port should be a valid URL",
        )

        # Validate JWT token format (should be non-empty string)
        self.assertIsInstance(
            om_config.openmetadata_jwt_token, str, "JWT token should be a string"
        )
        self.assertGreater(
            len(om_config.openmetadata_jwt_token), 0, "JWT token should not be empty"
        )

        # Validate service name format
        self.assertIsInstance(
            om_config.openmetadata_service_name, str, "Service name should be a string"
        )
        self.assertGreater(
            len(om_config.openmetadata_service_name),
            0,
            "Service name should not be empty",
        )

    def test_workflow_config_creation_with_custom_options(self):
        """Test workflow configuration creation with custom DBT options"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            target_dir = temp_path / "target"
            target_dir.mkdir()

            # Create required manifest.json file
            manifest_file = target_dir / "manifest.json"
            manifest_file.write_text('{"metadata": {"dbt_schema_version": "v1"}}')

            # Test with custom configuration using dict format only
            custom_om_config = OpenMetadataDBTConfig(
                openmetadata_host_port="http://test-server:port/endpoint",
                openmetadata_jwt_token="test-jwt-token",
                openmetadata_service_name="test_service",
                openmetadata_dbt_update_descriptions=False,
                openmetadata_dbt_update_owners=False,
                openmetadata_include_tags=False,
                openmetadata_search_across_databases=True,
                openmetadata_dbt_classification_name="custom_tags",
                openmetadata_database_filter_pattern={"includes": ["prod_*"]},
                openmetadata_schema_filter_pattern={
                    "includes": ["public"],
                    "excludes": ["temp_*"],
                },
                openmetadata_table_filter_pattern={"includes": ["fact_*"]},
            )

            config = create_dbt_workflow_config(temp_path, custom_om_config)

            # Validate structure
            self.assertIn("source", config)
            self.assertIn("sink", config)
            self.assertIn("workflowConfig", config)

            # Validate custom source config values
            source_config = config["source"]["sourceConfig"]["config"]
            self.assertEqual(source_config["type"], "DBT")
            self.assertFalse(source_config["dbtUpdateDescriptions"])
            self.assertFalse(source_config["dbtUpdateOwners"])
            self.assertFalse(source_config["includeTags"])
            self.assertTrue(source_config["searchAcrossDatabases"])
            self.assertEqual(source_config["dbtClassificationName"], "custom_tags")

            # Validate custom filter patterns
            self.assertEqual(
                source_config["databaseFilterPattern"], {"includes": ["prod_*"]}
            )
            self.assertEqual(
                source_config["schemaFilterPattern"],
                {"includes": ["public"], "excludes": ["temp_*"]},
            )
            self.assertEqual(
                source_config["tableFilterPattern"], {"includes": ["fact_*"]}
            )

    def test_workflow_config_creation(self):
        """Test workflow configuration creation"""
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            target_dir = temp_path / "target"
            target_dir.mkdir()

            # Test with all artifact files
            manifest_file = target_dir / "manifest.json"
            manifest_file.write_text('{"metadata": {"dbt_schema_version": "v1"}}')
            catalog_file = target_dir / "catalog.json"
            catalog_file.write_text('{"metadata": {"generated_at": "2023-01-01"}}')
            run_results_file = target_dir / "run_results.json"
            run_results_file.write_text('{"metadata": {"generated_at": "2023-01-01"}}')

            # Use default config
            default_om_config = OpenMetadataDBTConfig(
                openmetadata_host_port="http://test-server:port/endpoint",
                openmetadata_jwt_token="test-jwt-token",
                openmetadata_service_name="test_service",
            )

            config = create_dbt_workflow_config(temp_path, default_om_config)

            # Validate structure
            self.assertIn("source", config)
            self.assertIn("sink", config)
            self.assertIn("workflowConfig", config)
            self.assertEqual(config["source"]["serviceName"], "test_service")
            self.assertEqual(config["source"]["sourceConfig"]["config"]["type"], "DBT")

            # Test missing manifest error
            manifest_file.unlink()
            with self.assertRaises(FileNotFoundError) as context:
                create_dbt_workflow_config(temp_path, default_om_config)
            self.assertIn("manifest.json not found", str(context.exception))

    @patch("metadata.cli.ingest_dbt.MetadataWorkflow")
    def test_cli_execution(self, mock_workflow_class):
        """Test CLI execution - success and error cases"""
        mock_workflow = MagicMock()
        mock_workflow_class.create.return_value = mock_workflow

        # Test successful execution
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            target_dir = temp_path / "target"
            target_dir.mkdir()

            # Create required files
            (target_dir / "manifest.json").write_text('{"metadata": {}}')
            (temp_path / "dbt_project.yml").write_text(
                """
name: 'test_project'
vars:
  openmetadata_host_port: 'http://test-server:port/endpoint'
  openmetadata_jwt_token: 'test-jwt-token'
  openmetadata_service_name: 'test_service'
"""
            )

            run_ingest_dbt(temp_path)
            mock_workflow_class.create.assert_called_once()
            mock_workflow.execute.assert_called_once()

        # Test path errors
        with self.assertRaises(SystemExit):
            run_ingest_dbt(Path("/non/existent/path"))

    def test_integration_with_test_config(self):
        """Integration test using actual test resources with comprehensive validation"""
        config = find_dbt_project_config(self.test_resources_path)

        # Validate the loaded config has proper structure
        self.assertIn("vars", config)
        self.assertIsInstance(config["vars"], dict)

        # Extract and validate OpenMetadata config
        om_config = extract_openmetadata_config(config)

        # Verify extracted configuration matches expected values exactly
        self.assertIsInstance(om_config, OpenMetadataDBTConfig)
        self.assertEqual(
            om_config.openmetadata_host_port, "http://test-server:port/endpoint"
        )
        # Get the expected JWT token from environment variable (same as what gets substituted)
        expected_jwt_token = os.environ.get("OPENMETADATA_JWT_TOKEN")
        self.assertEqual(om_config.openmetadata_jwt_token, expected_jwt_token)
        self.assertEqual(om_config.openmetadata_service_name, "test_service")

        # Verify optional configuration from test file
        self.assertTrue(
            om_config.openmetadata_dbt_update_descriptions
        )  # explicitly set to true
        self.assertFalse(
            om_config.openmetadata_dbt_update_owners
        )  # explicitly set to false
        self.assertTrue(
            om_config.openmetadata_include_tags
        )  # default value (not in config)
        self.assertFalse(
            om_config.openmetadata_search_across_databases
        )  # default value (not in config)
        self.assertEqual(
            om_config.openmetadata_dbt_classification_name, "dbtTags"
        )  # custom value

        # Verify filter patterns from test file (dict format only)
        self.assertEqual(om_config.database_filter.includes, ["dbt_test_*"])
        self.assertEqual(om_config.database_filter.excludes, ["temp_*", "test_*"])

        self.assertEqual(
            om_config.schema_filter.includes, [".*"]
        )  # default (not specified in config)
        self.assertIsNone(
            om_config.schema_filter.excludes
        )  # default (not specified in config)

        self.assertEqual(om_config.table_filter.includes, [".*"])
        self.assertEqual(om_config.table_filter.excludes, ["temp_.*", "tmp_.*"])

        # Validate that the extracted config can be used to create workflow config
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            (temp_path / "target").mkdir()
            (temp_path / "target" / "manifest.json").write_text('{"metadata": {}}')

            workflow_config = create_dbt_workflow_config(temp_path, om_config)

            # Validate workflow config uses the extracted values correctly
            self.assertIsInstance(workflow_config, dict)
            self.assertEqual(workflow_config["source"]["serviceName"], "test_service")
            self.assertEqual(
                workflow_config["workflowConfig"]["openMetadataServerConfig"][
                    "hostPort"
                ],
                "http://test-server:port/endpoint",
            )
            # Get the expected JWT token from environment variable (same as what gets substituted)
            expected_jwt_token = os.environ.get("OPENMETADATA_JWT_TOKEN")
            self.assertEqual(
                workflow_config["workflowConfig"]["openMetadataServerConfig"][
                    "securityConfig"
                ]["jwtToken"],
                expected_jwt_token,
            )

            # Validate the optional config in the workflow
            source_config = workflow_config["source"]["sourceConfig"]["config"]
            self.assertTrue(source_config["dbtUpdateDescriptions"])
            self.assertFalse(source_config["dbtUpdateOwners"])
            self.assertTrue(source_config["includeTags"])  # default value
            self.assertFalse(source_config["searchAcrossDatabases"])  # default value
            self.assertEqual(source_config["dbtClassificationName"], "dbtTags")

            # Validate filter patterns in workflow config (standardized dict format)
            expected_db_pattern = {
                "includes": ["dbt_test_*"],
                "excludes": ["temp_*", "test_*"],
            }
            expected_schema_pattern = {"includes": [".*"]}  # default pattern
            expected_table_pattern = {
                "includes": [".*"],
                "excludes": ["temp_.*", "tmp_.*"],
            }

            self.assertEqual(
                source_config["databaseFilterPattern"], expected_db_pattern
            )
            self.assertEqual(
                source_config["schemaFilterPattern"], expected_schema_pattern
            )
            self.assertEqual(
                source_config["tableFilterPattern"], expected_table_pattern
            )
