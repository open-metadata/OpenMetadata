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
dbt Cloud Pipeline Profiler Source

Extracts pipeline observability data from dbt Cloud and maps it to table entities
"""
import traceback
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.source.pipeline.dbtcloud.client import DBTCloudClient
from metadata.ingestion.source.pipeline.dbtcloud.models import DBTJob
from metadata.ingestion.source.pipeline.pipeline_profiler_source import (
    PipelineProfilerSource,
)
from metadata.utils import fqn
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DBTCloudProfilerSource(PipelineProfilerSource):
    """
    dbt Cloud implementation of pipeline profiler source
    """

    def __init__(self, config, metadata):
        super().__init__(config, metadata)
        self.service_name = config.serviceName
        self.service_connection_config: DBTCloudConnection = (
            config.serviceConnection.root.config
        )
        self.client = DBTCloudClient(self.service_connection_config)

        # Cache for database service names
        self._database_service_names: Optional[List[str]] = None

    def get_table_pipeline_observability(
        self,
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:
        """
        Extract pipeline observability data from dbt Cloud and map to table FQNs
        """
        try:
            table_observability_map: Dict[str, List[PipelineObservability]] = {}

            # Get dbt Cloud jobs
            jobs = self._get_dbt_jobs()

            for job in jobs:
                try:
                    # Get recent runs for this job
                    recent_runs = self.client.get_runs(job_id=job.id)

                    if recent_runs:
                        latest_run = recent_runs[0]  # Most recent run

                        # Get pipeline entity reference
                        pipeline_fqn = f"{self.service_name}.{job.name}"
                        pipeline_entity = self.metadata.get_by_name(
                            entity=Pipeline, fqn=pipeline_fqn
                        )

                        if not pipeline_entity:
                            logger.warning(f"Pipeline not found: {pipeline_fqn}")
                            continue

                        pipeline_ref = EntityReference(
                            id=pipeline_entity.id,
                            type="pipeline",
                            name=pipeline_entity.name.root
                            if hasattr(pipeline_entity.name, "root")
                            else pipeline_entity.name,
                            fullyQualifiedName=pipeline_entity.fullyQualifiedName.root
                            if hasattr(pipeline_entity.fullyQualifiedName, "root")
                            else pipeline_entity.fullyQualifiedName,
                        )

                        # Extract table FQNs that this dbt job processes
                        table_fqns = self._extract_table_fqns_from_job(job)

                        # Create observability data
                        # Use run-specific times for accurate runtime calculation
                        observability = PipelineObservability(
                            pipeline=pipeline_ref,
                            scheduleInterval=job.schedule.cron
                            if job.schedule
                            else None,
                            startTime=self._convert_to_timestamp(latest_run.started_at)
                            if latest_run.started_at
                            else None,
                            endTime=self._convert_to_timestamp(latest_run.finished_at)
                            if latest_run.finished_at
                            else None,
                            lastRunTime=self._convert_to_timestamp(
                                latest_run.finished_at
                            )
                            if latest_run.finished_at
                            else None,
                            lastRunStatus=self._map_dbt_run_status(latest_run.status),
                        )

                        # Map observability data to each table
                        for table_fqn in table_fqns:
                            if table_fqn not in table_observability_map:
                                table_observability_map[table_fqn] = []
                            table_observability_map[table_fqn].append(observability)

                except Exception as exc:
                    logger.warning(f"Failed to process dbt Cloud job {job.id}: {exc}")
                    continue

            yield table_observability_map

        except Exception as exc:
            logger.error(f"Failed to extract dbt Cloud pipeline observability: {exc}")
            logger.debug(traceback.format_exc())

    def _get_dbt_jobs(self) -> List[DBTJob]:
        """
        Get dbt Cloud jobs based on configuration
        """
        jobs = []

        try:
            # If specific job IDs are configured, get those
            if self.service_connection_config.jobIds:
                for job_id in self.service_connection_config.jobIds:
                    job_list = self.client._get_jobs(job_id=str(job_id))
                    if job_list:
                        jobs.extend(job_list)

            # If specific project IDs are configured, get jobs for those projects
            elif self.service_connection_config.projectIds:
                for project_id in self.service_connection_config.projectIds:
                    job_list = self.client._get_jobs(project_id=str(project_id))
                    if job_list:
                        jobs.extend(job_list)

            # Otherwise get all jobs for the account
            else:
                job_list = self.client._get_jobs()
                if job_list:
                    jobs.extend(job_list)

        except Exception as exc:
            logger.error(f"Failed to fetch dbt Cloud jobs: {exc}")
            logger.debug(traceback.format_exc())

        return jobs

    def _extract_table_fqns_from_job(self, job: DBTJob) -> List[str]:
        """
        Extract table FQNs that this dbt job processes.
        Uses both model details and models/seeds details to get comprehensive table coverage.
        """
        table_fqns = []

        try:
            # Get the latest run for this job to extract processed tables
            recent_runs = self.client.get_runs(job_id=job.id)

            if not recent_runs:
                logger.warning(f"No runs found for dbt Cloud job {job.id}")
                return table_fqns

            latest_run = recent_runs[0]  # Most recent run

            # Get models with dependency info (primary table source)
            dbt_models = self.client.get_model_details(
                job_id=job.id, run_id=latest_run.id
            )

            # Get all models and seeds (comprehensive table source)
            dbt_models_and_seeds = self.client.get_models_and_seeds_details(
                job_id=job.id, run_id=latest_run.id
            )

            # Process models from get_model_details (primary source like in lineage)
            for model in dbt_models or []:
                if model.database and model.dbtschema and model.name:
                    # Use fqn.build() with database service names like PipelineServiceSource
                    for db_service_name in self.get_db_service_names():
                        table_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            service_name=db_service_name,
                            database_name=model.database,
                            schema_name=model.dbtschema,
                            table_name=model.name,
                        )
                        if table_fqn and table_fqn not in table_fqns:
                            table_fqns.append(table_fqn)

            # Process additional models and seeds from get_models_and_seeds_details
            for model in dbt_models_and_seeds or []:
                if model.database and model.dbtschema and model.name:
                    # Use fqn.build() with database service names like PipelineServiceSource
                    for db_service_name in self.get_db_service_names():
                        table_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            service_name=db_service_name,
                            database_name=model.database,
                            schema_name=model.dbtschema,
                            table_name=model.name,
                        )
                        if table_fqn and table_fqn not in table_fqns:
                            table_fqns.append(table_fqn)

        except Exception as exc:
            logger.warning(
                f"Failed to extract table FQNs from dbt Cloud job {job.id}: {exc}"
            )

        return table_fqns

    def _convert_to_timestamp(self, dt_str: str) -> Optional[Timestamp]:
        """Convert dbt Cloud datetime string to Timestamp following DBT Cloud pattern"""
        if not dt_str:
            return None

        try:
            # dbt Cloud typically uses ISO format
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            return Timestamp(datetime_to_ts(dt))
        except Exception as exc:
            logger.warning(f"Failed to parse datetime {dt_str}: {exc}")
            return None

    def _map_dbt_run_status(self, status: int) -> str:
        """Map dbt Cloud run status to OpenMetadata pipeline status"""
        status_mapping = {
            1: "Successful",  # Success
            2: "Failed",  # Error
            3: "Skipped",  # Cancelled
            10: "Running",  # Running
            20: "Pending",  # Queued
        }
        return status_mapping.get(status, "Pending")
