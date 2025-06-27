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

import json
import os
import re
import sys
import traceback
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

from metadata.ingestion.ometa.credentials import URL
from metadata.utils.logger import cli_logger
from metadata.workflow.metadata import MetadataWorkflow

logger = cli_logger()


class FilterPattern(BaseModel):
    """Filter pattern model for database/schema/table filtering"""

    includes: List[str] = Field(default=[".*"], description="Patterns to include")
    excludes: Optional[List[str]] = Field(
        default=None, description="Patterns to exclude"
    )


class OpenMetadataDBTConfig(BaseModel):
    """Pydantic model for OpenMetadata DBT configuration"""

    # Required fields
    openmetadata_host_port: str = Field(
        ..., description="OpenMetadata server host and port"
    )
    openmetadata_jwt_token: str = Field(..., description="JWT token for authentication")
    openmetadata_service_name: str = Field(
        ..., description="Service name for the DBT service"
    )

    # Optional DBT source configuration with defaults
    openmetadata_dbt_update_descriptions: bool = Field(
        default=True, description="Update model descriptions from DBT"
    )
    openmetadata_dbt_update_owners: bool = Field(
        default=True, description="Update model owners from DBT"
    )
    openmetadata_include_tags: bool = Field(
        default=True, description="Include DBT tags as metadata"
    )
    openmetadata_search_across_databases: bool = Field(
        default=False, description="Search across multiple databases"
    )
    openmetadata_dbt_classification_name: Optional[str] = Field(
        default=None, description="Custom classification name for DBT tags"
    )

    # Filter patterns - standardized to dict format only
    openmetadata_database_filter_pattern: Optional[Dict[str, List[str]]] = Field(
        default=None, description="Database filter pattern with includes/excludes"
    )
    openmetadata_schema_filter_pattern: Optional[Dict[str, List[str]]] = Field(
        default=None, description="Schema filter pattern with includes/excludes"
    )
    openmetadata_table_filter_pattern: Optional[Dict[str, List[str]]] = Field(
        default=None, description="Table filter pattern with includes/excludes"
    )

    @field_validator("openmetadata_host_port")
    @classmethod
    def validate_host_port(cls, v):
        """Validate that host_port is a valid URL using the existing URL class"""
        try:
            # This will raise ValueError if not a valid http/https/ws/wss URL
            URL(v)
            return v
        except (ValueError, TypeError) as e:
            raise ValueError(
                f"Host port must be a valid URL starting with http:// or https://: {e}"
            )

    def _get_filter_pattern(
        self, pattern_dict: Optional[Dict[str, List[str]]]
    ) -> FilterPattern:
        """Convert filter pattern dict to FilterPattern model or return default"""
        if pattern_dict:
            return FilterPattern(**pattern_dict)
        return FilterPattern()

    @property
    def database_filter(self) -> FilterPattern:
        """Get database filter pattern as FilterPattern model"""
        return self._get_filter_pattern(self.openmetadata_database_filter_pattern)

    @property
    def schema_filter(self) -> FilterPattern:
        """Get schema filter pattern as FilterPattern model"""
        return self._get_filter_pattern(self.openmetadata_schema_filter_pattern)

    @property
    def table_filter(self) -> FilterPattern:
        """Get table filter pattern as FilterPattern model"""
        return self._get_filter_pattern(self.openmetadata_table_filter_pattern)

    def log_configuration(self):
        config = {
            "update_descriptions": self.openmetadata_dbt_update_descriptions,
            "update_owners": self.openmetadata_dbt_update_owners,
            "include_tags": self.openmetadata_include_tags,
            "search_across_databases": self.openmetadata_search_across_databases,
            "classification_name": self.openmetadata_dbt_classification_name,
            "database_filter": self.database_filter.model_dump(exclude_none=True),
            "schema_filter": self.schema_filter.model_dump(exclude_none=True),
            "table_filter": self.table_filter.model_dump(exclude_none=True),
        }
        logger.info("OpenMetadata DBT Config:\n%s", json.dumps(config, indent=2))


def substitute_env_vars(content: str) -> str:
    """
    Substitute environment variables in YAML content.

    Supports:
    - ${VAR} - shell style substitution
    - {{ env_var("VAR") }} - dbt style without default
    - {{ env_var("VAR", "default") }} - dbt style with default

    :param content: Raw YAML content string
    :return: Content with environment variables substituted
    """

    def replace_shell_vars(match):
        """Replace ${VAR} pattern"""
        var_name = match.group(1)
        env_value = os.environ.get(var_name)
        if env_value is None:
            raise ValueError(f"Environment variable '{var_name}' is not set")
        return env_value

    def replace_dbt_env_vars(match):
        """Replace {{ env_var("VAR") }} and {{ env_var("VAR", "default") }} patterns"""
        var_name = match.group(1)
        default_value = match.group(2)  # Will be None if no default provided

        env_value = os.environ.get(var_name)
        if env_value is None:
            if default_value is not None:
                # Remove quotes from default value
                return default_value.strip("\"'")
            raise ValueError(
                f"Environment variable '{var_name}' is not set and no default provided"
            )
        return env_value

    # Pattern for ${VAR}
    shell_pattern = re.compile(r"\$\{([^}]+)\}")

    # Pattern for {{ env_var("VAR") }} and {{ env_var("VAR", "default") }}
    # This handles both single and double quotes around variable names and defaults
    function_pattern = re.compile(
        r'\{\{\s*env_var\(\s*["\']([\w-]+)["\']\s*(?:,\s*["\']([\w\s-]*)["\']\s*)?\)\s*\}\}'
    )

    # Apply substitutions
    content = shell_pattern.sub(replace_shell_vars, content)
    content = function_pattern.sub(replace_dbt_env_vars, content)

    return content


def find_dbt_project_config(dbt_project_path: Path) -> Dict:
    """
    Find and load dbt_project.yml configuration with environment variable substitution

    :param dbt_project_path: Path to the dbt project directory
    :return: Parsed dbt project configuration
    """
    # Load environment variables from .env file if present
    load_dotenv(dbt_project_path / ".env", override=False)
    load_dotenv(override=False)  # fallback to current dir

    dbt_project_file = dbt_project_path / "dbt_project.yml"

    if not dbt_project_file.exists():
        raise FileNotFoundError(f"dbt_project.yml not found in {dbt_project_path}")

    try:
        with open(dbt_project_file, "r", encoding="utf-8") as file:
            content = file.read()

        # Substitute environment variables before parsing YAML
        processed_content = substitute_env_vars(content)
        return yaml.safe_load(processed_content)

    except Exception as exc:
        raise ValueError(f"Failed to parse dbt_project.yml: {exc}")


def extract_openmetadata_config(dbt_config: Dict) -> OpenMetadataDBTConfig:
    """
    Extract and validate OpenMetadata configuration from dbt project config using Pydantic

    :param dbt_config: Parsed dbt project configuration
    :return: Validated OpenMetadata configuration model
    """
    vars_config = dbt_config.get("vars", {})
    try:
        # Create and validate the configuration using Pydantic
        om_config = OpenMetadataDBTConfig(**vars_config)
        om_config.log_configuration()
        return om_config

    except Exception as exc:
        # Provide helpful error message for missing required fields
        error_msg = str(exc)
        if "Field required" in error_msg:
            raise ValueError(
                f"Required OpenMetadata configuration not found in dbt_project.yml vars.\n"
                f"Error: {error_msg}\n"
                f"Please add the following to your dbt_project.yml:\n"
                f"vars:\n"
                f"  openmetadata_jwt_token: 'your-jwt-token'\n"
                f"  openmetadata_host_port: 'your-host-port (e.g. http://openmetadata-server:8585/api)'\n"
                f"  openmetadata_service_name: 'your-service-name'"
            )
        raise ValueError(f"Invalid OpenMetadata configuration: {error_msg}")


def create_dbt_workflow_config(
    dbt_project_path: Path, om_config: OpenMetadataDBTConfig
) -> Dict:
    """
    Create OpenMetadata workflow configuration for dbt artifacts ingestion

    :param dbt_project_path: Path to the dbt project directory
    :param om_config: Validated OpenMetadata configuration model
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
        "dbtManifestFilePath": str(manifest_path),
        "dbtConfigType": "local",
    }

    # Add optional files if they exist
    catalog_path = target_dir / "catalog.json"
    if catalog_path.exists():
        dbt_config_source["dbtCatalogFilePath"] = str(catalog_path)

    run_results_path = target_dir / "run_results.json"
    if run_results_path.exists():
        dbt_config_source["dbtRunResultsFilePath"] = str(run_results_path)

    # Build source config with user-configurable options
    source_config = {
        "type": "DBT",
        "dbtConfigSource": dbt_config_source,
        "dbtUpdateDescriptions": om_config.openmetadata_dbt_update_descriptions,
        "dbtUpdateOwners": om_config.openmetadata_dbt_update_owners,
        "includeTags": om_config.openmetadata_include_tags,
        "searchAcrossDatabases": om_config.openmetadata_search_across_databases,
        "databaseFilterPattern": om_config.database_filter.model_dump(
            exclude_none=True
        ),
        "schemaFilterPattern": om_config.schema_filter.model_dump(exclude_none=True),
        "tableFilterPattern": om_config.table_filter.model_dump(exclude_none=True),
    }

    # Add optional classification name if provided
    if om_config.openmetadata_dbt_classification_name:
        source_config[
            "dbtClassificationName"
        ] = om_config.openmetadata_dbt_classification_name

    # Create workflow configuration
    config = {
        "source": {
            "type": "dbt",
            "serviceName": om_config.openmetadata_service_name,
            "sourceConfig": {"config": source_config},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "INFO",
            "openMetadataServerConfig": {
                "hostPort": om_config.openmetadata_host_port,
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": om_config.openmetadata_jwt_token},
            },
        },
    }

    return config


def run_ingest_dbt(dbt_project_path: Path) -> None:
    """
    Run the dbt artifacts ingestion workflow from a dbt project path

    :param dbt_project_path: Path to the dbt project directory
    """
    try:
        # Resolve to absolute path to handle relative paths like "."
        dbt_project_path = dbt_project_path.resolve()

        logger.info(f"Starting DBT artifacts ingestion from: {dbt_project_path}")

        if not dbt_project_path.exists():
            raise FileNotFoundError(
                f"DBT project path does not exist: {dbt_project_path}"
            )

        if not dbt_project_path.is_dir():
            raise NotADirectoryError(
                f"DBT project path is not a directory: {dbt_project_path}"
            )

        logger.info("Loading dbt project configuration...")
        dbt_config = find_dbt_project_config(dbt_project_path)

        logger.info("Extracting OpenMetadata configuration...")
        om_config = extract_openmetadata_config(dbt_config)

        logger.info(f"Publishing to OpenMetadata: {om_config.openmetadata_host_port}")
        logger.info(f"Service name: {om_config.openmetadata_service_name}")

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
