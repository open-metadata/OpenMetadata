"""
Test DBT Ingestion CLI module
"""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from metadata.cli.ingest_dbt import (
    create_dbt_workflow_config,
    extract_openmetadata_config,
    find_dbt_project_config,
    run_ingest_dbt,
)


class DbtIngestCLIUnitTest(unittest.TestCase):
    """Test cases for DBT Ingestion CLI functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.test_resources_path = Path(__file__).parent / "resources" / "dbt_ingest"
        self.expected_om_config = {
            'jwt_token': 'test-jwt-token',
            'host_port': 'http://test-server:port/endpoint',
            'service_name': 'test_service'
        }

    def test_dbt_project_config_vars_validation(self):
        """Test dbt_project.yml vars section validation and structure"""
        # Test successful loading and vars validation
        config = find_dbt_project_config(self.test_resources_path)
        
        # Validate basic structure
        self.assertIsInstance(config, dict)
        self.assertEqual(config['name'], 'jaffle_shop')
        self.assertEqual(config['version'], '1.0.0')
        self.assertIn('vars', config)
        
        # Validate vars section structure and required OpenMetadata variables
        vars_section = config['vars']
        self.assertIsInstance(vars_section, dict)
        
        # Validate all required OpenMetadata variables exist
        required_om_vars = [
            'openmetadata_host_port',
            'openmetadata_jwt_token', 
            'openmetadata_service_name'
        ]
        
        for var_name in required_om_vars:
            self.assertIn(var_name, vars_section, f"Missing required variable: {var_name}")
            self.assertIsNotNone(vars_section[var_name], f"Variable {var_name} should not be None")
            self.assertNotEqual(vars_section[var_name].strip(), "", f"Variable {var_name} should not be empty")
        
        # Validate specific values match expected test configuration
        self.assertEqual(vars_section['openmetadata_host_port'], 'http://test-server:port/endpoint')
        self.assertEqual(vars_section['openmetadata_jwt_token'], 'test-jwt-token')
        self.assertEqual(vars_section['openmetadata_service_name'], 'test_service')
        
        # Test file not found error
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaises(FileNotFoundError) as context:
                find_dbt_project_config(Path(temp_dir))
            self.assertIn("dbt_project.yml not found", str(context.exception))

    def test_openmetadata_config_extraction_comprehensive(self):
        """Test comprehensive OpenMetadata configuration extraction and validation"""
        # Test successful extraction with exact expected values
        valid_config = {
            'vars': {
                'openmetadata_host_port': 'http://test-server:port/endpoint',
                'openmetadata_jwt_token': 'test-jwt-token',
                'openmetadata_service_name': 'test_service'
            }
        }
        om_config = extract_openmetadata_config(valid_config)
        
        # Validate extracted config structure and values
        self.assertEqual(om_config, self.expected_om_config)
        self.assertIn('host_port', om_config)
        self.assertIn('jwt_token', om_config)
        self.assertIn('service_name', om_config)
        
        # Test each missing variable scenario individually for better error messages
        test_cases = [
            # Missing JWT token
            {
                'config': {'vars': {'openmetadata_host_port': 'http://test', 'openmetadata_service_name': 'test'}},
                'expected_error': 'openmetadata_jwt_token'
            },
            # Missing host port
            {
                'config': {'vars': {'openmetadata_jwt_token': 'token', 'openmetadata_service_name': 'test'}},
                'expected_error': 'openmetadata_host_port'
            },
            # Missing service name
            {
                'config': {'vars': {'openmetadata_host_port': 'http://test', 'openmetadata_jwt_token': 'token'}},
                'expected_error': 'openmetadata_service_name'
            },
            # Missing multiple variables
            {
                'config': {'vars': {'openmetadata_host_port': 'http://test'}},
                'expected_error': 'openmetadata_jwt_token'
            },
            # Missing all variables
            {
                'config': {'vars': {}},
                'expected_error': 'openmetadata_host_port'
            },
            # No vars section
            {
                'config': {'name': 'test_project'},
                'expected_error': 'openmetadata_host_port'
            }
        ]
        
        for i, test_case in enumerate(test_cases):
            with self.subTest(f"Missing variable test case {i+1}"):
                with self.assertRaises(ValueError) as context:
                    extract_openmetadata_config(test_case['config'])
                error_msg = str(context.exception)
                self.assertIn("Missing variables:", error_msg)
                self.assertIn(test_case['expected_error'], error_msg)

    def test_dbt_project_yml_vars_format_validation(self):
        """Test that dbt_project.yml vars follow correct format and naming convention"""
        config = find_dbt_project_config(self.test_resources_path)
        vars_section = config['vars']
        
        # Test that we only use standard OpenMetadata naming
        standard_vars = [var for var in vars_section.keys() if var.startswith('openmetadata_')]
        self.assertEqual(len(standard_vars), 3, "Should have exactly 3 OpenMetadata variables")
        
        # Validate URL format
        host_port = vars_section['openmetadata_host_port']
        self.assertTrue(host_port.startswith('http://') or host_port.startswith('https://'),
                       "Host port should be a valid URL")
        
        # Validate JWT token format (should be non-empty string)
        jwt_token = vars_section['openmetadata_jwt_token']
        self.assertIsInstance(jwt_token, str, "JWT token should be a string")
        self.assertGreater(len(jwt_token), 0, "JWT token should not be empty")
        
        # Validate service name format
        service_name = vars_section['openmetadata_service_name']
        self.assertIsInstance(service_name, str, "Service name should be a string")
        self.assertGreater(len(service_name), 0, "Service name should not be empty")
        
        # Service name should not contain spaces or special characters typically
        self.assertNotIn(' ', service_name, "Service name should not contain spaces")

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
            
            config = create_dbt_workflow_config(temp_path, self.expected_om_config)
            
            # Validate structure
            self.assertIn('source', config)
            self.assertIn('sink', config)
            self.assertIn('workflowConfig', config)
            self.assertEqual(config['source']['serviceName'], 'test_service')
            self.assertEqual(config['source']['sourceConfig']['config']['type'], 'DBT')
            
            # Test missing manifest error
            manifest_file.unlink()
            with self.assertRaises(FileNotFoundError) as context:
                create_dbt_workflow_config(temp_path, self.expected_om_config)
            self.assertIn("manifest.json not found", str(context.exception))


    @patch('metadata.cli.ingest_dbt.MetadataWorkflow')
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
            (temp_path / "dbt_project.yml").write_text("""
name: 'test_project'
vars:
  openmetadata_host_port: 'http://test-server:port/endpoint'
  openmetadata_jwt_token: 'test-jwt-token'
  openmetadata_service_name: 'test_service'
""")
            
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
        self.assertIn('vars', config)
        self.assertIsInstance(config['vars'], dict)
        
        # Extract and validate OpenMetadata config
        om_config = extract_openmetadata_config(config)
        
        # Verify extracted configuration matches expected values exactly
        self.assertEqual(om_config['host_port'], 'http://test-server:port/endpoint')
        self.assertEqual(om_config['jwt_token'], 'test-jwt-token') 
        self.assertEqual(om_config['service_name'], 'test_service')
        
        # Validate that the extracted config can be used to create workflow config
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            (temp_path / "target").mkdir()
            (temp_path / "target" / "manifest.json").write_text('{"metadata": {}}')
            
            workflow_config = create_dbt_workflow_config(temp_path, om_config)
            
            # Validate workflow config uses the extracted values correctly
            self.assertIsInstance(workflow_config, dict)
            self.assertEqual(workflow_config['source']['serviceName'], 'test_service')
            self.assertEqual(
                workflow_config['workflowConfig']['openMetadataServerConfig']['hostPort'],
                'http://test-server:port/endpoint'
            )
            self.assertEqual(
                workflow_config['workflowConfig']['openMetadataServerConfig']['securityConfig']['jwtToken'],
                'test-jwt-token'
            )


if __name__ == '__main__':
    unittest.main()
