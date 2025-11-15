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
Airflow Pipeline Profiler Source

Extracts pipeline observability data from Airflow and maps it to table entities
"""
import traceback
from datetime import datetime
from typing import Dict, Iterable, List, Optional

from airflow.models.dag import DagModel
from airflow.models.dagrun import DagRun
from airflow.models.taskinstance import TaskInstance
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.type.basic import DateTime as OMDateTime
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.ingestion.source.pipeline.airflow.connection import get_connection
from metadata.ingestion.source.pipeline.pipeline_profiler_source import (
    PipelineProfilerSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AirflowProfilerSource(PipelineProfilerSource):
    """
    Airflow implementation of pipeline profiler source
    """

    def __init__(self, config: SourceConfig, metadata, service_name: str):
        super().__init__(config, metadata, service_name)
        self.service_connection_config: AirflowConnection = (
            config.serviceConnection.root.config
        )
        self.client = get_connection(self.service_connection_config)

    def get_table_pipeline_observability(
        self,
    ) -> Iterable[Dict[str, List[PipelineObservability]]]:
        """
        Extract pipeline observability data from Airflow and map to table FQNs
        """
        try:
            session = Session(bind=self.client)

            # Query DAGs and their recent runs
            dags = (
                session.query(DagModel)
                .filter(DagModel.is_active == True, DagModel.is_paused == False)
                .all()
            )

            table_observability_map: Dict[str, List[PipelineObservability]] = {}

            for dag in dags:
                try:
                    # Get recent DAG runs
                    recent_runs = (
                        session.query(DagRun)
                        .filter(DagRun.dag_id == dag.dag_id)
                        .order_by(DagRun.execution_date.desc())
                        .limit(5)
                        .all()
                    )

                    if recent_runs:
                        latest_run = recent_runs[0]

                        # Get pipeline entity reference
                        pipeline_fqn = f"{self.service_name}.{dag.dag_id}"
                        pipeline_entity = self.metadata.get_by_name(
                            entity=Pipeline, fqn=pipeline_fqn
                        )

                        if not pipeline_entity:
                            logger.warning(f"Pipeline not found: {pipeline_fqn}")
                            continue

                        pipeline_ref = EntityReference(
                            id=pipeline_entity.id,
                            type="pipeline",
                            name=pipeline_entity.name,
                            fullyQualifiedName=pipeline_entity.fullyQualifiedName,
                        )

                        # Extract table FQNs from task instances
                        table_fqns = self._extract_table_fqns_from_dag(
                            session, dag.dag_id, latest_run.run_id
                        )

                        # Create observability data
                        observability = PipelineObservability(
                            pipeline=pipeline_ref,
                            schedule={
                                "scheduleInterval": dag.schedule_interval,
                                "startTime": self._convert_to_om_datetime(
                                    dag.start_date
                                )
                                if dag.start_date
                                else None,
                                "endTime": self._convert_to_om_datetime(dag.end_date)
                                if dag.end_date
                                else None,
                            },
                            lastRunTime=self._convert_to_om_datetime(
                                latest_run.execution_date
                            ),
                            lastRunStatus=self._map_dag_run_state(latest_run.state),
                        )

                        # Map observability data to each table
                        for table_fqn in table_fqns:
                            if table_fqn not in table_observability_map:
                                table_observability_map[table_fqn] = []
                            table_observability_map[table_fqn].append(observability)

                except Exception as exc:
                    logger.warning(f"Failed to process DAG {dag.dag_id}: {exc}")
                    continue

            yield table_observability_map

        except Exception as exc:
            logger.error(f"Failed to extract Airflow pipeline observability: {exc}")
            logger.debug(traceback.format_exc())
        finally:
            if "session" in locals():
                session.close()

    def _extract_table_fqns_from_dag(
        self, session: Session, dag_id: str, run_id: str
    ) -> List[str]:
        """
        Extract table FQNs from DAG task instances.
        This is a simplified implementation - in reality, you'd need more sophisticated
        parsing of task configurations to identify which tables are processed.
        """
        table_fqns = []

        try:
            # Get task instances for the latest run
            task_instances = (
                session.query(TaskInstance)
                .filter(TaskInstance.dag_id == dag_id, TaskInstance.run_id == run_id)
                .all()
            )

            for task_instance in task_instances:
                # This is a placeholder - you would implement logic here to:
                # 1. Parse task configurations/SQL to identify source/target tables
                # 2. Extract table names from task metadata
                # 3. Map them to OpenMetadata table FQNs

                # For demo purposes, we'll check if task name suggests table processing
                if any(
                    keyword in task_instance.task_id.lower()
                    for keyword in ["table", "extract", "transform", "load"]
                ):
                    # This would be replaced with actual table FQN extraction logic
                    # table_fqns.append(f"service.database.schema.{task_instance.task_id}")
                    pass

        except Exception as exc:
            logger.warning(f"Failed to extract table FQNs from DAG {dag_id}: {exc}")

        return table_fqns

    def _convert_to_om_datetime(self, dt) -> Optional[OMDateTime]:
        """Convert datetime to OpenMetadata DateTime format"""
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return OMDateTime(dt)
        return OMDateTime(dt)

    def _map_dag_run_state(self, state: str) -> str:
        """Map Airflow DAG run state to OpenMetadata pipeline status"""
        state_mapping = {
            "success": "Successful",
            "failed": "Failed",
            "running": "Running",
            "queued": "Pending",
            "skipped": "Skipped",
        }
        return state_mapping.get(state, "Pending")
