"""
Workflow runner for executing OpenMetadata workflows in parallel.
"""

import logging
import os
from datetime import datetime
from typing import Any, Dict

import yaml

from metadata.workflow.application import ApplicationWorkflow
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.usage import UsageWorkflow

logger = logging.getLogger(__name__)


class WorkflowRunner:
    """Runner for executing OpenMetadata workflows."""

    def __init__(self, config_path: str = "/config/workflow-config.yaml"):
        """Initialize with configuration path."""
        self.config_path = config_path
        self.workflow_config = self._load_config()

        self.workflow_classes = {
            "metadata": MetadataWorkflow,
            "usage": UsageWorkflow,
            "profiler": ProfilerWorkflow,
            "dataQuality": TestSuiteWorkflow,
            "application": ApplicationWorkflow,
            "autoClassification": AutoClassificationWorkflow,
        }

    def _load_config(self) -> Dict[str, Any]:
        """Load workflow configuration from file."""
        try:
            with open(self.config_path, "r") as file:
                return yaml.safe_load(file)
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise

    def get_workflow_type(self) -> str:
        """Determine workflow type from configuration."""
        workflow_type = self.workflow_config.get("workflowType")
        if workflow_type:
            return workflow_type

        source_config_type = (
            self.workflow_config.get("source", {})
            .get("sourceConfig", {})
            .get("config", {})
            .get("type", "")
        )

        if "Metadata" in source_config_type:
            return "metadata"
        elif "Usage" in source_config_type:
            return "usage"
        elif "Lineage" in source_config_type:
            return "lineage"
        elif "Profiler" in source_config_type:
            return "profiler"
        elif "DataQuality" in source_config_type:
            return "dataQuality"
        else:
            return "metadata"  # Default

    def execute_shard(self, shard: Dict[str, Any]) -> Dict[str, Any]:
        """Execute workflow for a specific shard."""
        pod_name = os.environ.get("HOSTNAME", "unknown")
        shard_id = shard.get("id", "unknown")

        logger.info(f"Pod [{pod_name}] starting execution for shard: {shard_id}")
        start_time = datetime.utcnow()

        try:
            shard_config = self._apply_shard_config(shard)

            workflow_type = self.get_workflow_type()
            workflow_class = self.workflow_classes.get(workflow_type, MetadataWorkflow)

            logger.info(f"Using workflow class: {workflow_class.__name__}")

            workflow = workflow_class.create(shard_config)
            workflow.execute()

            workflow.stop()

            steps = workflow.workflow_steps()
            if steps and len(steps) > 0:
                source_status = steps[0].get_status()
                records = (
                    len(source_status.records)
                    if hasattr(source_status, "records") and source_status.records
                    else 0
                )
                warnings = (
                    len(source_status.warnings)
                    if hasattr(source_status, "warnings") and source_status.warnings
                    else 0
                )
                failures = (
                    len(source_status.failures)
                    if hasattr(source_status, "failures") and source_status.failures
                    else 0
                )
            else:
                records = 0
                warnings = 0
                failures = 0

            duration = (datetime.utcnow() - start_time).total_seconds()

            result = {
                "shard_id": shard_id,
                "pod_name": pod_name,
                "duration": duration,
                "records": records,
                "warnings": warnings,
                "errors": failures,
                "status": "success" if failures == 0 else "partial",
                "start_time": start_time.isoformat(),
                "end_time": datetime.utcnow().isoformat(),
                "records_per_second": records / duration if duration > 0 else 0,
            }

            logger.info(
                f"Pod [{pod_name}] completed shard {shard_id} in {duration:.2f}s "
                f"(records: {result['records']}, warnings: {result['warnings']}, "
                f"errors: {result['errors']})"
            )

            return result

        except Exception as e:
            logger.error(
                f"Pod [{pod_name}] failed for shard {shard_id}: {e}", exc_info=True
            )
            return {
                "shard_id": shard_id,
                "pod_name": pod_name,
                "duration": (datetime.utcnow() - start_time).total_seconds(),
                "status": "failed",
                "error": str(e),
            }

    def _apply_shard_config(self, shard: Dict[str, Any]) -> Dict[str, Any]:
        """Apply shard-specific configuration to base workflow config."""
        import sys

        sys.path.insert(0, "/app/ingestion/parallel")

        from processor.sharding import ShardingFactory

        strategy = ShardingFactory.create(self.workflow_config)

        return strategy.configure_shard(self.workflow_config, shard)
