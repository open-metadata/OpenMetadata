#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Argo Workflows orchestrator for distributed ingestion.

Generates and submits Argo Workflow definitions for parallel
entity processing across multiple pods.
"""
import base64
import json
from typing import Any, Dict, List, Optional

import yaml

from metadata.ingestion.api.distributed import DiscoverableSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ArgoWorkflowOrchestrator:
    """
    Generates Argo Workflow YAML for distributed ingestion.

    Works with any DiscoverableSource to create workflows that:
    1. Discover entities in a lightweight discovery pod
    2. Fan out to N parallel worker pods
    3. Process entities independently with automatic retries
    """

    def __init__(
        self,
        namespace: str = "default",
        service_account: Optional[str] = None,
        image: str = "openmetadata/ingestion:latest",
    ):
        self.namespace = namespace
        self.service_account = service_account
        self.image = image

    def generate_workflow(
        self,
        workflow_config: Dict[str, Any],
        source: DiscoverableSource,
        parallelism: int = 50,
        retry_limit: int = 3,
    ) -> Dict[str, Any]:
        """
        Generate complete Argo Workflow definition.

        Args:
            workflow_config: OpenMetadata workflow configuration
            source: Source implementing DiscoverableSource
            parallelism: Maximum parallel worker pods
            retry_limit: Number of retries for failed entities

        Returns:
            Argo Workflow definition as dict
        """
        entity_types = source.get_parallelizable_entity_types()
        dependencies = source.get_entity_type_dependencies()

        config_b64 = self._encode_config(workflow_config)

        workflow = {
            "apiVersion": "argoproj.io/v1alpha1",
            "kind": "Workflow",
            "metadata": {
                "generateName": f"{workflow_config.get('source', {}).get('serviceName', 'om')}-ingestion-",
                "namespace": self.namespace,
            },
            "spec": {
                "entrypoint": "main",
                "arguments": {
                    "parameters": [
                        {"name": "workflow-config", "value": config_b64},
                        {"name": "parallelism", "value": str(parallelism)},
                    ]
                },
                "templates": [
                    self._build_main_dag(entity_types, dependencies, parallelism),
                    self._build_discovery_template(),
                    self._build_worker_template(retry_limit),
                ],
            },
        }

        if self.service_account:
            workflow["spec"]["serviceAccountName"] = self.service_account

        return workflow

    def _build_main_dag(
        self,
        entity_types: List[str],
        dependencies: Dict[str, List[str]],
        parallelism: int,
    ) -> Dict[str, Any]:
        """Build main DAG template with discovery and processing phases"""
        tasks = []

        # Discovery tasks - one per entity type
        for entity_type in entity_types:
            # Replace underscores with hyphens for Argo task names
            task_name = entity_type.replace("_", "-")
            tasks.append(
                {
                    "name": f"discover-{task_name}",
                    "template": "discover",
                    "arguments": {
                        "parameters": [{"name": "entity-type", "value": entity_type}]
                    },
                }
            )

        # Processing tasks - parallel workers per entity type
        for entity_type in entity_types:
            # Replace underscores with hyphens for Argo task names
            task_name = entity_type.replace("_", "-")
            task = {
                "name": f"process-{task_name}",
                "dependencies": [f"discover-{task_name}"],
                "template": "worker",
                "arguments": {
                    "parameters": [{"name": "entity", "value": "{{item}}"}]
                },
                "withParam": f"{{{{tasks.discover-{task_name}.outputs.parameters.entities}}}}",
            }

            # Add dependencies if specified
            if entity_type in dependencies:
                for dep in dependencies[entity_type]:
                    if f"process-{dep}" not in task["dependencies"]:
                        task["dependencies"].append(f"process-{dep}")

            # Set parallelism
            task["parallelism"] = parallelism

            tasks.append(task)

        return {"name": "main", "dag": {"tasks": tasks}}

    def _build_discovery_template(self) -> Dict[str, Any]:
        """Build discovery template that runs lightweight entity discovery"""
        return {
            "name": "discover",
            "inputs": {"parameters": [{"name": "entity-type"}]},
            "script": {
                "image": self.image,
                "command": ["python"],
                "source": """
import os
import sys
import json
import base64
import yaml

# Add metadata module to path
sys.path.insert(0, "/home/airflow/ingestion/src")

from metadata.distributed_cmd.discover import discover_entities_cli

if __name__ == "__main__":
    # Get workflow config
    config_b64 = os.environ["WORKFLOW_CONFIG"]
    config_yaml = base64.b64decode(config_b64).decode()

    # Get entity type
    entity_type = os.environ["ENTITY_TYPE"]

    # Run discovery
    discover_entities_cli(config_yaml, entity_type, "/tmp/entities.json")
""",
                "env": [
                    {
                        "name": "WORKFLOW_CONFIG",
                        "value": "{{workflow.parameters.workflow-config}}",
                    },
                    {"name": "ENTITY_TYPE", "value": "{{inputs.parameters.entity-type}}"},
                ],
            },
            "outputs": {
                "parameters": [
                    {"name": "entities", "valueFrom": {"path": "/tmp/entities.json"}}
                ]
            },
        }

    def _build_worker_template(self, retry_limit: int) -> Dict[str, Any]:
        """Build worker template that processes single entity"""
        return {
            "name": "worker",
            "inputs": {"parameters": [{"name": "entity"}]},
            "retryStrategy": {
                "limit": retry_limit,
                "backoff": {
                    "duration": "60s",
                    "factor": 2,
                    "maxDuration": "10m",
                },
                "retryPolicy": "OnFailure",
            },
            "script": {
                "image": self.image,
                "command": ["python"],
                "source": """
import os
import sys
import json
import base64
import yaml

# Add metadata module to path
sys.path.insert(0, "/home/airflow/ingestion/src")

from metadata.distributed_cmd.process_entity import process_entity_cli

if __name__ == "__main__":
    # Get workflow config
    config_b64 = os.environ["WORKFLOW_CONFIG"]
    config_yaml = base64.b64decode(config_b64).decode()

    # Get entity descriptor
    entity_json = os.environ["ENTITY"]

    # Process entity
    process_entity_cli(config_yaml, entity_json)
""",
                "env": [
                    {
                        "name": "WORKFLOW_CONFIG",
                        "value": "{{workflow.parameters.workflow-config}}",
                    },
                    {"name": "ENTITY", "value": "{{inputs.parameters.entity}}"},
                ],
                "resources": {
                    "requests": {"memory": "1Gi", "cpu": "500m"},
                    "limits": {"memory": "2Gi", "cpu": "1000m"},
                },
            },
        }

    def _encode_config(self, config: Dict[str, Any]) -> str:
        """Encode workflow config as base64 for passing to pods"""
        # Convert to JSON string and back to ensure all Pydantic models are serialized
        # This preserves type information while avoiding Python-specific YAML tags
        if hasattr(config, 'model_dump'):
            # Pydantic v2 model
            config_dict = config.model_dump(mode='json', by_alias=True)
        elif hasattr(config, 'dict'):
            # Pydantic v1 model or dict with nested models
            config_dict = json.loads(json.dumps(config, default=lambda o: o.dict() if hasattr(o, 'dict') else str(o)))
        else:
            # Plain dict, convert any nested Pydantic models
            config_dict = json.loads(json.dumps(config, default=lambda o: o.model_dump(mode='json') if hasattr(o, 'model_dump') else (o.dict() if hasattr(o, 'dict') else str(o))))

        config_yaml = yaml.dump(config_dict, default_flow_style=False)
        return base64.b64encode(config_yaml.encode()).decode()

    def generate_workflow_yaml(
        self,
        workflow_config: Dict[str, Any],
        source: DiscoverableSource,
        parallelism: int = 50,
        retry_limit: int = 3,
    ) -> str:
        """
        Generate Argo Workflow as YAML string.

        Convenience method that returns YAML instead of dict.
        """
        workflow_dict = self.generate_workflow(
            workflow_config, source, parallelism, retry_limit
        )
        return yaml.dump(workflow_dict, default_flow_style=False, sort_keys=False)

    def save_workflow_to_file(
        self,
        workflow_config: Dict[str, Any],
        source: DiscoverableSource,
        output_path: str,
        parallelism: int = 50,
        retry_limit: int = 3,
    ):
        """Save generated workflow to YAML file"""
        workflow_yaml = self.generate_workflow_yaml(
            workflow_config, source, parallelism, retry_limit
        )

        with open(output_path, "w") as f:
            f.write(workflow_yaml)

        logger.info(f"Saved Argo Workflow to {output_path}")
