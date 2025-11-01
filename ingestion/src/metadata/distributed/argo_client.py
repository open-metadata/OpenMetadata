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
Argo Workflows client for submitting and monitoring distributed workflows.
"""
import time
from typing import Any, Dict, Optional

from pydantic import BaseModel

from metadata.ingestion.api.distributed import DiscoverableSource
from metadata.distributed.argo_orchestrator import ArgoWorkflowOrchestrator
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class WorkflowResult(BaseModel):
    """Result of workflow execution"""

    workflow_id: str
    status: str
    message: Optional[str] = None


class ArgoWorkflowClient:
    """
    Client for interacting with Argo Workflows.

    Submits workflows, monitors execution, and retrieves results.
    """

    def __init__(
        self,
        namespace: str = "default",
        service_account: Optional[str] = None,
        image: str = "openmetadata/ingestion:latest",
        argo_server_url: Optional[str] = None,
    ):
        """
        Initialize Argo Workflows client.

        Args:
            namespace: Kubernetes namespace for workflows
            service_account: Service account for workflow pods
            image: Docker image for worker pods
            argo_server_url: Argo Server API URL (if using Argo Server mode)
        """
        self.namespace = namespace
        self.service_account = service_account
        self.image = image
        self.argo_server_url = argo_server_url
        self.orchestrator = ArgoWorkflowOrchestrator(
            namespace=namespace,
            service_account=service_account,
            image=image,
        )

    def submit_workflow(
        self,
        workflow_config: Dict[str, Any],
        source: DiscoverableSource,
        parallelism: int = 50,
        retry_limit: int = 3,
    ) -> str:
        """
        Submit Argo Workflow for distributed execution.

        Args:
            workflow_config: OpenMetadata workflow configuration
            source: Source implementing DiscoverableSource
            parallelism: Maximum parallel workers
            retry_limit: Retry attempts per entity

        Returns:
            Workflow ID for monitoring

        Raises:
            Exception if submission fails
        """
        logger.info("Generating Argo Workflow definition...")

        workflow_dict = self.orchestrator.generate_workflow(
            workflow_config, source, parallelism, retry_limit
        )

        logger.info(
            f"Submitting workflow to namespace '{self.namespace}' "
            f"with parallelism={parallelism}"
        )

        try:
            workflow_id = self._submit_to_argo(workflow_dict)
            logger.info(f"Successfully submitted workflow: {workflow_id}")
            return workflow_id
        except Exception as exc:
            logger.error(f"Failed to submit workflow: {exc}")
            raise

    def _submit_to_argo(self, workflow_dict: Dict[str, Any]) -> str:
        """
        Submit workflow to Argo via Kubernetes API or Argo Server.

        Args:
            workflow_dict: Argo Workflow definition

        Returns:
            Workflow name/ID

        Raises:
            Exception if submission fails
        """
        try:
            from kubernetes import client, config

            # Try in-cluster config first (when running in a pod),
            # fallback to local kubeconfig (when running on local machine)
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            custom_api = client.CustomObjectsApi()

            response = custom_api.create_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace=self.namespace,
                plural="workflows",
                body=workflow_dict,
            )

            workflow_name = response["metadata"]["name"]
            logger.info(f"Created workflow: {workflow_name}")
            return workflow_name

        except ImportError:
            logger.error(
                "kubernetes Python client not installed. "
                "Install with: pip install kubernetes"
            )
            raise
        except Exception as exc:
            logger.error(f"Failed to create workflow via Kubernetes API: {exc}")
            raise

    def get_workflow_status(self, workflow_id: str) -> WorkflowResult:
        """
        Get current status of a workflow.

        Args:
            workflow_id: Workflow name

        Returns:
            WorkflowResult with status and message
        """
        try:
            from kubernetes import client, config

            # Try in-cluster config first (when running in a pod),
            # fallback to local kubeconfig (when running on local machine)
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            custom_api = client.CustomObjectsApi()

            workflow = custom_api.get_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace=self.namespace,
                plural="workflows",
                name=workflow_id,
            )

            status = workflow.get("status", {})
            phase = status.get("phase", "Unknown")
            message = status.get("message", "")

            return WorkflowResult(
                workflow_id=workflow_id, status=phase, message=message
            )

        except Exception as exc:
            logger.error(f"Failed to get workflow status: {exc}")
            return WorkflowResult(
                workflow_id=workflow_id, status="Unknown", message=str(exc)
            )

    def wait_for_completion(
        self, workflow_id: str, timeout: int = 86400, poll_interval: int = 30
    ) -> WorkflowResult:
        """
        Wait for workflow to complete.

        Args:
            workflow_id: Workflow name
            timeout: Maximum wait time in seconds
            poll_interval: Time between status checks in seconds

        Returns:
            Final WorkflowResult

        Raises:
            TimeoutError if workflow doesn't complete within timeout
        """
        start_time = time.time()

        logger.info(f"Waiting for workflow {workflow_id} to complete...")

        while time.time() - start_time < timeout:
            result = self.get_workflow_status(workflow_id)

            if result.status in ["Succeeded", "Failed", "Error"]:
                logger.info(
                    f"Workflow {workflow_id} completed with status: {result.status}"
                )
                return result

            logger.debug(
                f"Workflow {workflow_id} status: {result.status}. "
                f"Waiting {poll_interval}s..."
            )
            time.sleep(poll_interval)

        raise TimeoutError(
            f"Workflow {workflow_id} did not complete within {timeout} seconds"
        )

    def delete_workflow(self, workflow_id: str):
        """
        Delete a workflow.

        Args:
            workflow_id: Workflow name to delete
        """
        try:
            from kubernetes import client, config

            # Try in-cluster config first (when running in a pod),
            # fallback to local kubeconfig (when running on local machine)
            try:
                config.load_incluster_config()
            except config.ConfigException:
                config.load_kube_config()

            custom_api = client.CustomObjectsApi()

            custom_api.delete_namespaced_custom_object(
                group="argoproj.io",
                version="v1alpha1",
                namespace=self.namespace,
                plural="workflows",
                name=workflow_id,
            )

            logger.info(f"Deleted workflow: {workflow_id}")

        except Exception as exc:
            logger.error(f"Failed to delete workflow: {exc}")
            raise
