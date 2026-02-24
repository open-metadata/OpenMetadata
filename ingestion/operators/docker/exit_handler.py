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
Exit handler safety net for Kubernetes ingestion pipeline jobs
"""

import logging
import os
from datetime import datetime
from typing import Optional

import yaml
from kubernetes import client, config
from kubernetes.client import V1Pod
from pydantic import BaseModel

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    IngestionStatus,
    StackTraceError,
    StepSummary,
)
from metadata.generated.schema.metadataIngestion.application import (
    OpenMetadataApplicationConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ometa_logger, set_loggers_level


class FailureDiagnostics(BaseModel):
    """
    Model to represent diagnostic information gathered from failed workflow pods.

    Attributes:
        pod_logs: Logs from the main container, or None if unavailable
        pod_description: Detailed pod status and event information, or None if unavailable
        has_diagnostics: True if any diagnostic information was successfully gathered
    """

    pod_logs: Optional[str] = None
    pod_description: Optional[str] = None

    @property
    def has_diagnostics(self) -> bool:
        """Check if any diagnostic information is available."""
        return self.pod_logs is not None or self.pod_description is not None

    @property
    def summary(self) -> str:
        """Get a brief summary of available diagnostics."""
        parts = []
        if self.pod_logs:
            lines = len(self.pod_logs.splitlines())
            parts.append(f"logs ({lines} lines)")
        if self.pod_description:
            parts.append("pod description")

        if parts:
            return f"Available diagnostics: {', '.join(parts)}"
        return "No diagnostics available"


SUCCESS_STATES = {"Succeeded", "success"}
TERMINAL_PIPELINE_STATES = {
    PipelineState.success,
    PipelineState.failed,
    PipelineState.partialSuccess,
}
logger = ometa_logger()


def get_kubernetes_client() -> Optional[client.CoreV1Api]:
    """
    Initialize and return Kubernetes client.
    First tries in-cluster config, then falls back to local kubeconfig.
    This function is fault-tolerant and will not raise exceptions.
    """
    try:
        # Try in-cluster config first (when running inside a pod)
        config.load_incluster_config()
        return client.CoreV1Api()
    except Exception as in_cluster_error:
        try:
            # Fall back to local kubeconfig
            config.load_kube_config()
            return client.CoreV1Api()
        except Exception as kubeconfig_error:
            logger.warning(
                f"Failed to initialize Kubernetes client - in-cluster: {in_cluster_error}, kubeconfig: {kubeconfig_error}"
            )
            return None
    except Exception as unexpected_error:
        logger.error(
            f"Unexpected error initializing Kubernetes client: {unexpected_error}"
        )
        return None


LABEL_JOB_NAME = "job-name"
LABEL_OMJOB_NAME = "omjob.pipelines.openmetadata.org/name"
LABEL_POD_TYPE = "omjob.pipelines.openmetadata.org/pod-type"
LABEL_APP_RUN_ID = "app.kubernetes.io/run-id"
POD_TYPE_MAIN = "main"


def find_main_pod(
    k8s_client: client.CoreV1Api,
    job_name: Optional[str],
    namespace: str,
    pipeline_run_id: Optional[str] = None,
) -> Optional[V1Pod]:
    """
    Find the main ingestion pod for the given Kubernetes job.
    This function is fault-tolerant and will not raise exceptions.
    """
    try:
        if not namespace or (not job_name and not pipeline_run_id):
            logger.warning(
                "Invalid parameters: job_name=%s, pipeline_run_id=%s, namespace=%s",
                job_name,
                pipeline_run_id,
                namespace,
            )
            return None

        label_selectors = []

        if job_name:
            label_selectors.extend(
                [
                    f"{LABEL_JOB_NAME}={job_name}",
                    f"{LABEL_OMJOB_NAME}={job_name},{LABEL_POD_TYPE}={POD_TYPE_MAIN}",
                    f"{LABEL_OMJOB_NAME}={job_name}",
                ]
            )

        if pipeline_run_id:
            label_selectors.extend(
                [
                    f"{LABEL_APP_RUN_ID}={pipeline_run_id},{LABEL_POD_TYPE}={POD_TYPE_MAIN}",
                    f"{LABEL_APP_RUN_ID}={pipeline_run_id}",
                ]
            )

        for label_selector in label_selectors:
            try:
                pods = k8s_client.list_namespaced_pod(
                    namespace=namespace, label_selector=label_selector
                )
            except Exception as list_error:
                logger.warning(
                    f"Failed to list pods with selector '{label_selector}': {list_error}"
                )
                continue

            if not pods or not pods.items:
                continue

            for pod in pods.items:
                try:
                    if pod.metadata and pod.metadata.name:
                        logger.info(
                            f"Found main pod: {pod.metadata.name} (selector: {label_selector})"
                        )
                        return pod
                except Exception as pod_error:
                    logger.warning(f"Error checking pod metadata: {pod_error}")
                    continue

        logger.warning(f"No main pod found for job {job_name}")
        return None

    except Exception as e:
        logger.error(f"Failed to find main pod for job {job_name}: {e}")
        return None


def get_main_pod_logs(
    k8s_client: client.CoreV1Api, main_pod: V1Pod, namespace: str
) -> Optional[str]:
    """
    Fetch logs from the main ingestion pod.
    This function is fault-tolerant and will not raise exceptions.

    Args:
        k8s_client: Kubernetes API client
        main_pod: The main pod object
        namespace: Kubernetes namespace

    Returns:
        Main pod logs as string, or None if unable to fetch
    """
    try:
        if not main_pod or not main_pod.metadata or not main_pod.metadata.name:
            logger.warning("Invalid pod object provided for log fetching")
            return None

        pod_name = main_pod.metadata.name
        logger.info(f"Fetching logs from pod '{pod_name}'")

        logs = k8s_client.read_namespaced_pod_log(
            name=pod_name, namespace=namespace, container="main", tail_lines=500
        )

        if logs:
            logger.info(f"Successfully fetched {len(logs.splitlines())} lines of logs")
            return logs
        else:
            logger.info("No logs found for pod")
            return None

    except Exception as e:
        logger.warning(
            f"Failed to fetch pod logs from {main_pod.metadata.name if main_pod and main_pod.metadata else 'unknown'}: {e}"
        )
        return None


def get_main_pod_description(
    k8s_client: client.CoreV1Api, main_pod: V1Pod, namespace: str
) -> Optional[str]:
    """
    Get detailed pod description for the main ingestion pod.
    This function is fault-tolerant and will not raise exceptions.

    Args:
        k8s_client: Kubernetes API client
        main_pod: The main pod object
        namespace: Kubernetes namespace

    Returns:
        Pod description string, or None if unable to fetch
    """
    try:
        if not main_pod or not main_pod.metadata or not main_pod.metadata.name:
            logger.warning("Invalid pod object provided for description")
            return None

        # Get detailed pod information
        pod_name = main_pod.metadata.name
        logger.info(f"Getting pod description for '{pod_name}'")

        # Build detailed pod description with safe access to attributes
        description_parts = []

        try:
            description_parts.append(f"Pod: {pod_name}")
            description_parts.append(f"Namespace: {namespace}")

            # Safely access pod status
            if main_pod.status:
                if hasattr(main_pod.status, "phase") and main_pod.status.phase:
                    description_parts.append(f"Status: {main_pod.status.phase}")
                if hasattr(main_pod.status, "reason") and main_pod.status.reason:
                    description_parts.append(f"Reason: {main_pod.status.reason}")
                if hasattr(main_pod.status, "message") and main_pod.status.message:
                    description_parts.append(f"Message: {main_pod.status.message}")

                # Safely log container statuses
                if (
                    hasattr(main_pod.status, "container_statuses")
                    and main_pod.status.container_statuses
                ):
                    description_parts.append("\nContainer Statuses:")
                    for container_status in main_pod.status.container_statuses:
                        try:
                            status_line = f"  {container_status.name}: Ready={container_status.ready}, RestartCount={container_status.restart_count}"
                            description_parts.append(status_line)

                            if container_status.state:
                                if container_status.state.waiting:
                                    description_parts.append(
                                        f"    State: Waiting - {container_status.state.waiting.reason}"
                                    )
                                elif container_status.state.running:
                                    description_parts.append(
                                        f"    State: Running - Started: {container_status.state.running.started_at}"
                                    )
                                elif container_status.state.terminated:
                                    description_parts.append(
                                        f"    State: Terminated - Reason: {container_status.state.terminated.reason}, ExitCode: {container_status.state.terminated.exit_code}"
                                    )
                        except Exception as container_error:
                            logger.warning(
                                f"Error processing container status: {container_error}"
                            )
                            continue
        except Exception as status_error:
            logger.warning(f"Error processing pod status: {status_error}")

        # Try to get pod events but don't fail if unavailable
        try:
            events = k8s_client.list_namespaced_event(
                namespace=namespace, field_selector=f"involvedObject.name={pod_name}"
            )

            if events and events.items:
                description_parts.append(f"\nEvents ({len(events.items)} found):")
                for event in events.items[
                    -10:
                ]:  # Limit to last 10 events (most recent)
                    try:
                        event_time = (
                            event.last_timestamp or event.first_timestamp or "Unknown"
                        )
                        description_parts.append(
                            f"  {event_time} - {event.type}: {event.reason}"
                        )
                        if event.message:
                            description_parts.append(f"    {event.message}")
                    except Exception as event_error:
                        logger.warning(f"Error processing event: {event_error}")
                        continue
            else:
                description_parts.append("\nEvents: No events found")
        except Exception as e:
            logger.warning(f"Could not fetch events for pod {pod_name}: {e}")
            description_parts.append(
                "\nEvents: Unable to fetch events. Make sure the ingestion service account has 'events' permissions."
            )

        description = "\n".join(description_parts)
        logger.info("Pod description created successfully")
        return description if description_parts else None

    except Exception as e:
        logger.error(f"Failed to get pod description: {e}")
        return None


def create_pod_diagnostics(
    main_pod_logs: Optional[str], pod_description: Optional[str]
) -> StepSummary:
    """
    Create a StepSummary with pod diagnostics for failed workflows.
    """
    # Combine logs and description for stackTrace
    summary_parts = []
    if pod_description:
        summary_parts.append("Pod Description:\n" + pod_description)
    if main_pod_logs:
        summary_parts.append("\nPod Logs: \n" + main_pod_logs)

    stack_trace = (
        "\n".join(summary_parts) if summary_parts else "No diagnostics available"
    )

    return StepSummary(
        name="Pod Diagnostics",
        records=0,
        errors=1,
        failures=[
            StackTraceError(
                name="Main Container Diagnostics",
                error="Kubernetes job failed - check logs for details",
                stackTrace=stack_trace,
            )
        ],
    )


def create_workflow_config(config: str, pipeline_run_id: str):
    """
    Create appropriate workflow configuration based on config type.

    Args:
        config: Raw configuration string from environment
        pipeline_run_id: Pipeline run identifier

    Returns:
        Union[OpenMetadataApplicationConfig, OpenMetadataWorkflowConfig]: Parsed workflow config
    """
    raw_workflow_config = yaml.safe_load(config)
    raw_workflow_config["pipelineRunId"] = pipeline_run_id

    if raw_workflow_config.get("sourcePythonClass"):
        logger.info("Creating OpenMetadataApplicationConfig")
        return OpenMetadataApplicationConfig.model_validate(raw_workflow_config)
    else:
        logger.info("Creating OpenMetadataWorkflowConfig")
        return OpenMetadataWorkflowConfig.model_validate(raw_workflow_config)


def get_or_create_pipeline_status(
    metadata: OpenMetadata, workflow_config
) -> PipelineStatus:
    """
    Retrieve existing pipeline status or create a new one.

    Args:
        metadata: OpenMetadata API client
        workflow_config: Workflow configuration object
        pipeline_run_id: Pipeline run identifier

    Returns:
        PipelineStatus: Existing or newly created pipeline status
    """
    pipeline_status = metadata.get_pipeline_status(
        workflow_config.ingestionPipelineFQN,
        str(workflow_config.pipelineRunId.root),
    )

    if not pipeline_status:
        logger.info("No existing pipeline status found, creating new one")
        now_timestamp = Timestamp(int(datetime.now().timestamp() * 1000))
        pipeline_status = PipelineStatus(
            runId=str(workflow_config.pipelineRunId.root),
            startDate=now_timestamp,
            timestamp=now_timestamp,
        )
    else:
        logger.info("Using existing pipeline status")

    return pipeline_status


def gather_failure_diagnostics(
    job_name: Optional[str], namespace: str, pipeline_run_id: Optional[str] = None
) -> FailureDiagnostics:
    """
    Gather diagnostic information from failed Kubernetes job pods.
    This function is fault-tolerant and will never raise exceptions.

    Args:
        job_name: Name of the failed Kubernetes job
        namespace: Kubernetes namespace

    Returns:
        FailureDiagnostics: Object containing pod logs and description, or empty if errors occur
    """
    try:
        logger.info(f"Kubernetes job failed, gathering diagnostics for: {job_name}")

        # Try to get Kubernetes client - fail gracefully if unavailable
        try:
            k8s_client = get_kubernetes_client()
        except Exception as e:
            logger.warning(f"Failed to initialize Kubernetes client: {e}")
            return FailureDiagnostics()

        if not k8s_client:
            logger.warning("Kubernetes client is not available - skipping diagnostics")
            return FailureDiagnostics()

        # Try to find main pod - fail gracefully if not found
        try:
            main_pod = find_main_pod(k8s_client, job_name, namespace, pipeline_run_id)
        except Exception as e:
            logger.warning(f"Failed to find main pod for job {job_name}: {e}")
            return FailureDiagnostics()

        if not main_pod:
            logger.warning(
                f"Could not find main pod for job {job_name} - skipping diagnostics"
            )
            return FailureDiagnostics()

        # Try to get pod logs - continue even if this fails
        pod_logs = None
        try:
            pod_logs = get_main_pod_logs(k8s_client, main_pod, namespace)
        except Exception as e:
            logger.warning(f"Failed to fetch pod logs: {e}")

        # Try to get pod description - continue even if this fails
        pod_description = None
        try:
            pod_description = get_main_pod_description(k8s_client, main_pod, namespace)
            if pod_description:
                logger.info("Successfully fetched pod description")
        except Exception as e:
            logger.warning(f"Failed to fetch pod description: {e}")

        # Create and return diagnostics object
        diagnostics = FailureDiagnostics(
            pod_logs=pod_logs, pod_description=pod_description
        )

        logger.info(diagnostics.summary)
        return diagnostics

    except Exception as e:
        # Catch-all for any unexpected errors - diagnostics should never break the exit handler
        logger.error(f"Unexpected error while gathering diagnostics: {e}")
        return FailureDiagnostics()


def update_pipeline_status_with_diagnostics(
    pipeline_status: PipelineStatus,
    diagnostics: FailureDiagnostics,
):
    """
    Add diagnostic information to pipeline status.
    This function is fault-tolerant and will not raise exceptions.

    Args:
        pipeline_status: Pipeline status object to update
        diagnostics: Failure diagnostics containing pod logs and description
    """
    try:
        if not diagnostics.has_diagnostics:
            logger.info("No diagnostics available to add to pipeline status")
            return

        error_step = create_pod_diagnostics(
            diagnostics.pod_logs, diagnostics.pod_description
        )

        try:
            if pipeline_status.status:
                existing_steps = (
                    pipeline_status.status.root
                    if hasattr(pipeline_status.status, "root")
                    else []
                )
                existing_steps.append(error_step)
                pipeline_status.status = IngestionStatus(existing_steps)
            else:
                pipeline_status.status = IngestionStatus([error_step])

            logger.info(
                f"Successfully added diagnostics to pipeline status - {diagnostics.summary}"
            )
        except Exception as e:
            logger.warning(f"Failed to update pipeline status with diagnostics: {e}")

    except Exception as e:
        logger.error(f"Failed to create pod diagnostics: {e}")


def main():
    """
    Exit Handler entrypoint for Kubernetes jobs

    The goal of this script is to be executed as a failure callback/exit handler
    when a Kubernetes job processing fails. There are situations where the failure
    cannot be directly controlled in the main ingestion process.

    We don't want to initialize the full workflow as it might be failing
    on the `__init__` call as well. We'll manually prepare the status sending
    logic.

    In this callback we just care about:
    - instantiating the ometa client
    - getting the IngestionPipeline FQN
    - if exists, update with `Failed` status
    """
    # Parse environment variables (adapted for K8s Job environment)
    config = os.getenv("config")
    if not config:
        error_msg = "Missing environment variable `config`. This is needed to configure the Workflow."
        raise RuntimeError(error_msg)

    pipeline_run_id = os.getenv("pipelineRunId")
    raw_pipeline_status = os.getenv("pipelineStatus")
    job_name = os.getenv("jobName")  # Changed from workflowName to jobName
    namespace = os.getenv("namespace")  # Changed from workflowNamespace to namespace

    logger.info(
        f"Environment variables - pipelineRunId: {pipeline_run_id}, pipelineStatus: {raw_pipeline_status}, jobName: {job_name}, namespace: {namespace}"
    )

    # Create workflow configuration
    workflow_config = create_workflow_config(config, pipeline_run_id)

    # Initialize OpenMetadata client
    metadata = OpenMetadata(
        config=workflow_config.workflowConfig.openMetadataServerConfig
    )

    # Update pipeline status if all required fields are present
    if workflow_config.ingestionPipelineFQN and pipeline_run_id and raw_pipeline_status:
        logger.info(
            f"Sending status to Ingestion Pipeline {workflow_config.ingestionPipelineFQN} for run ID {str(workflow_config.pipelineRunId.root)}"
        )

        # Get or create pipeline status
        pipeline_status = get_or_create_pipeline_status(metadata, workflow_config)

        # If the workflow already reported a terminal status, the exit handler has nothing to do.
        if pipeline_status.pipelineState in TERMINAL_PIPELINE_STATES:
            logger.info(
                f"Pipeline already in terminal state '{pipeline_status.pipelineState.value}', "
                f"skipping exit handler update"
            )
            return

        # Update pipeline status with final state
        pipeline_status.endDate = Timestamp(int(datetime.now().timestamp() * 1000))
        pipeline_status.pipelineState = (
            PipelineState.failed
            if raw_pipeline_status not in SUCCESS_STATES
            else PipelineState.success
        )

        # Try to gather diagnostics for failed jobs - but never let this block status reporting
        if raw_pipeline_status not in SUCCESS_STATES and job_name:
            try:
                logger.info("Attempting to gather failure diagnostics")
                diagnostics = gather_failure_diagnostics(
                    job_name, namespace, pipeline_run_id
                )
                update_pipeline_status_with_diagnostics(pipeline_status, diagnostics)
            except Exception as e:
                # Log the error but continue - diagnostics should never prevent status updates
                logger.error(
                    f"Failed to gather or add diagnostics, continuing with status update: {e}"
                )

        # Send updated status to OpenMetadata - this is the critical operation that must succeed
        try:
            metadata.create_or_update_pipeline_status(
                workflow_config.ingestionPipelineFQN, pipeline_status
            )
            logger.info(
                f"Successfully updated pipeline status to {pipeline_status.pipelineState.value}"
            )
        except Exception as e:
            logger.error(
                f"CRITICAL: Failed to send pipeline status update to OpenMetadata: {e}"
            )
            raise
    else:
        logger.info("Missing required fields - not updating pipeline status")


if __name__ == "__main__":
    set_loggers_level(logging.INFO)
    try:
        main()
    except Exception as e:
        logger.error(f"Exit handler failed: {e}")
        raise
