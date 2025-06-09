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
DBT Artifacts Ingestion CLI module
"""

import sys
import traceback
from pathlib import Path
from typing import Dict

import yaml
from metadata.utils.logger import cli_logger
from metadata.workflow.metadata import MetadataWorkflow

logger = cli_logger()


def find_dbt_project_config(dbt_project_path: Path) -> Dict:
    """
    Find and load dbt_project.yml configuration
    
    :param dbt_project_path: Path to the dbt project directory
    :return: Parsed dbt project configuration
    """
    dbt_project_file = dbt_project_path / "dbt_project.yml"
    
    if not dbt_project_file.exists():
        raise FileNotFoundError(f"dbt_project.yml not found in {dbt_project_path}")
        
    try:
        with open(dbt_project_file, 'r') as file:
            return yaml.safe_load(file)
    except Exception as exc:
        raise ValueError(f"Failed to parse dbt_project.yml: {exc}")


def extract_openmetadata_config(dbt_config: Dict) -> Dict:
    """
    Extract OpenMetadata connection configuration from dbt project config
    
    :param dbt_config: Parsed dbt project configuration
    :return: OpenMetadata configuration
    """
    vars_config = dbt_config.get('vars', {})
    
    # Look for OpenMetadata configuration in vars
    jwt_token = vars_config.get('dbt_col_openmetadata_jwt_token') or vars_config.get('openmetadata_jwt_token')
    host_port = vars_config.get('dbt_col_openmetadata_host_port') or vars_config.get('openmetadata_host_port')
    service_name = vars_config.get('dbt_col_openmetadata_service_name') or vars_config.get('openmetadata_service_name') or 'dbt'
    
    if not jwt_token or not host_port:
        raise ValueError(
            "OpenMetadata configuration not found in dbt_project.yml vars. "
            "Please add: 'openmetadata_jwt_token', 'openmetadata_host_port', and optionally 'openmetadata_service_name'"
        )
    
    return {
        'jwt_token': jwt_token,
        'host_port': host_port,
        'service_name': service_name
    }


def create_dbt_workflow_config(dbt_project_path: Path, om_config: Dict) -> Dict:
    """
    Create OpenMetadata workflow configuration for dbt artifacts ingestion
    
    :param dbt_project_path: Path to the dbt project directory
    :param om_config: OpenMetadata configuration
    :return: Workflow configuration
    """
    target_dir = dbt_project_path / "target"
    
    # Check for required artifacts
    manifest_path = target_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"manifest.json not found in {target_dir}. Please run 'dbt compile' or 'dbt run' first."
        )
    
    # Build dbt config source
    dbt_config_source = {
        'dbtManifestFilePath': str(manifest_path),
        'dbtConfigType': 'local'
    }
    
    # Add optional files if they exist
    catalog_path = target_dir / "catalog.json"
    if catalog_path.exists():
        dbt_config_source['dbtCatalogFilePath'] = str(catalog_path)
    
    run_results_path = target_dir / "run_results.json"
    if run_results_path.exists():
        dbt_config_source['dbtRunResultsFilePath'] = str(run_results_path)
    
    # Create workflow configuration
    config = {
        'source': {
            'type': 'dbt',
            'serviceName': om_config['service_name'],
            'sourceConfig': {
                'config': {
                    'type': 'DBT',
                    'dbtConfigSource': dbt_config_source,
                    'dbtUpdateDescriptions': True,
                    'dbtUpdateOwners': True,
                    'includeTags': True,
                    'searchAcrossDatabases': False,
                    'databaseFilterPattern': {
                        'includes': ['.*']
                    },
                    'schemaFilterPattern': {
                        'includes': ['.*']
                    },
                    'tableFilterPattern': {
                        'includes': ['.*']
                    }
                }
            }
        },
        'sink': {
            'type': 'metadata-rest',
            'config': {}
        },
        'workflowConfig': {
            'loggerLevel': 'INFO',
            'openMetadataServerConfig': {
                'hostPort': om_config['host_port'],
                'authProvider': 'openmetadata',
                'securityConfig': {
                    'jwtToken': om_config['jwt_token']
                }
            }
        }
    }
    
    return config


def run_ingest_dbt(dbt_project_path: Path) -> None:
    """
    Run the dbt artifacts ingestion workflow from a dbt project path
    
    :param dbt_project_path: Path to the dbt project directory
    """
    try:
        logger.info(f"Starting DBT artifacts ingestion from: {dbt_project_path}")
        
        # Validate that the path exists and is a directory
        if not dbt_project_path.exists():
            raise FileNotFoundError(f"DBT project path does not exist: {dbt_project_path}")
        
        if not dbt_project_path.is_dir():
            raise NotADirectoryError(f"DBT project path is not a directory: {dbt_project_path}")
        
        # Load dbt project configuration
        logger.info("Loading dbt project configuration...")
        dbt_config = find_dbt_project_config(dbt_project_path)
        
        # Extract OpenMetadata configuration
        logger.info("Extracting OpenMetadata configuration...")
        om_config = extract_openmetadata_config(dbt_config)
        
        logger.info(f"Publishing to OpenMetadata: {om_config['host_port']}")
        logger.info(f"Service name: {om_config['service_name']}")
        
        # Create workflow configuration
        logger.info("Creating workflow configuration...")
        workflow_config = create_dbt_workflow_config(dbt_project_path, om_config)
        
        # Create and execute the MetadataWorkflow (reusing existing infrastructure)
        logger.info("Starting OpenMetadata ingestion workflow...")
        workflow = MetadataWorkflow.create(workflow_config)
        workflow.execute()
        workflow.raise_from_status()
        workflow.print_status()
        workflow.stop()
        
        logger.info("DBT artifacts ingestion completed successfully")
        
    except Exception as exc:
        logger.error(f"Error during DBT artifacts ingestion: {exc}")
        logger.debug(traceback.format_exc())
        sys.exit(1) 