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
Workflow definition for the ORM Profiler.

- How to specify the source
- How to specify the entities to run
- How to define metrics & tests
"""

from __future__ import annotations

import time
import traceback
from datetime import datetime
from typing import Optional, Union, cast

from pydantic import ValidationError

from metadata.config.common import WorkflowExecutionError
from metadata.config.workflow import get_sink
from metadata.data_insight.helper.data_insight_es_index import DataInsightEsIndex
from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.data_insight.processor.entity_report_data_processor import (
    EntityReportDataProcessor,
)
from metadata.data_insight.processor.web_analytic_report_data_processor import (
    WebAnalyticEntityViewReportDataProcessor,
    WebAnalyticUserActivityReportDataProcessor,
)
from metadata.data_insight.runner.kpi_runner import KpiRunner
from metadata.generated.schema.analytics.reportData import ReportDataType
from metadata.generated.schema.dataInsight.kpi.kpi import Kpi
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
)
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.ometa.ometa_api import EntityList, OpenMetadata
from metadata.ingestion.sink.elasticsearch import ElasticsearchSink
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.utils.workflow_helper import (
    set_ingestion_pipeline_status as set_ingestion_pipeline_status_helper,
)
from metadata.utils.workflow_output_handler import print_data_insight_status

logger = data_insight_logger()

NOW = datetime.utcnow().timestamp() * 1000


class DataInsightWorkflow:
    """
    Configure and run the Data Insigt workflow

    Attributes:
    """

    def __init__(self, config: OpenMetadataWorkflowConfig) -> None:
        self.config = config
        self.metadata_config: OpenMetadataConnection = (
            self.config.workflowConfig.openMetadataServerConfig
        )
        self.metadata = OpenMetadata(self.metadata_config)
        self.set_ingestion_pipeline_status(state=PipelineState.running)

        self.status = ProcessorStatus()
        self.data_processor: Optional[
            Union[
                DataProcessor,
                EntityReportDataProcessor,
                WebAnalyticEntityViewReportDataProcessor,
                WebAnalyticUserActivityReportDataProcessor,
            ]
        ] = None

        self.kpi_runner: Optional[KpiRunner] = None

        if self.config.sink:
            self.sink = get_sink(
                sink_type="metadata-rest",
                sink_config=Sink(type="metadata-rest", config={}),  # type: ignore
                metadata_config=self.metadata_config,
                _from="data_insight",
            )

            self.es_sink = get_sink(
                sink_type=self.config.sink.type,
                sink_config=self.config.sink,
                metadata_config=self.metadata_config,
                _from="ingestion",
            )

            self.es_sink = cast(ElasticsearchSink, self.es_sink)

    @staticmethod
    def _is_kpi_active(entity: Kpi) -> bool:
        """Check if a KPI is active

        Args:
            entity (Kpi): KPI entity

        Returns:
            Kpi:
        """

        start_date = entity.startDate.__root__
        end_date = entity.endDate.__root__

        if not start_date or not end_date:
            logger.warning(
                f"Start date or End date was not defined.\n\t-startDate: {start_date}\n\t-end_date: {end_date}\n"
                "We won't be running the KPI validation"
            )
            return False

        if start_date <= NOW <= end_date:
            return True

        return False

    def _get_kpis(self) -> list[Kpi]:
        """get the list of KPIs and return the active ones

        Returns:
            _type_: _description_
        """

        kpis: EntityList[Kpi] = self.metadata.list_entities(
            entity=Kpi, fields="*"  # type: ignore
        )

        return [kpi for kpi in kpis.entities if self._is_kpi_active(kpi)]

    def _check_and_handle_existing_es_data(self, index: str) -> None:
        """Handles scenarios where data has already been ingested for the execution data.
        If we find some data for the execution date we should deleted those documents before
        re indexing new documents.
        """
        gte = get_beginning_of_day_timestamp_mill()
        lte = get_end_of_day_timestamp_mill()
        query = {
            "size": 1000,
            "query": {
                "range": {
                    "timestamp": {
                        "gte": gte,
                        "lte": lte,
                    }
                }
            },
        }
        data = self.es_sink.read_records(index, query)
        try:
            hit_total = data["hits"]["total"]["value"]
            documents = data["hits"]["hits"]
        except KeyError as exc:
            logger.error(exc)
        else:
            if hit_total > 0:
                body = [
                    {"delete": {"_index": document["_index"], "_id": document["_id"]}}
                    for document in documents
                ]
                try:
                    self.es_sink.bulk_operation(body)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Could not delete existing data - {exc}")
                    raise RuntimeError
            return None
        return None

    def _execute_data_processor(self):
        """Data processor method to refine raw data into report data and ingest it in ES"""
        for report_data_type in ReportDataType:
            has_checked_and_handled_existing_es_data = False
            logger.info(f"Processing data for report type {report_data_type}")
            try:
                self.data_processor = DataProcessor.create(
                    _data_processor_type=report_data_type.value, metadata=self.metadata
                )
                for record in self.data_processor.process():
                    if hasattr(self, "sink"):
                        self.sink.write_record(record)
                    if hasattr(self, "es_sink"):
                        if not has_checked_and_handled_existing_es_data:
                            self._check_and_handle_existing_es_data(
                                DataInsightEsIndex[record.data.__class__.__name__].value
                            )
                            has_checked_and_handled_existing_es_data = True
                        self.es_sink.write_record(record)
                    else:
                        logger.warning(
                            "No sink attribute found, skipping ingestion of KPI result"
                        )

            except Exception as exc:
                logger.error(
                    f"Error while executing data insight workflow for report type {report_data_type} -- {exc}"
                )
                logger.debug(traceback.format_exc())
                self.status.failure(
                    f"Error while executing data insight workflow for report type {report_data_type} -- {exc}"
                )

    def _execute_kpi_runner(self):
        """KPI runner method to run KPI definiton against platform latest metric"""
        kpis = self._get_kpis()
        self.kpi_runner = KpiRunner(kpis, self.metadata)

        for kpi_result in self.kpi_runner.run():
            if hasattr(self, "sink"):
                self.sink.write_record(kpi_result)
            else:
                logger.warning(
                    "No sink attribute found, skipping ingestion of KPI result"
                )

    @classmethod
    def create(cls, config_dict: dict) -> DataInsightWorkflow:
        """instantiate a class object

        Args:
            config_dict (dict): workflow config

        Raises:
            err: wrong config

        Returns:
            DataInsightWorkflow
        """
        try:
            config = parse_workflow_config_gracefully(config_dict)
            config = cast(OpenMetadataWorkflowConfig, config)  # for static type checked
            return cls(config)
        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to parse the Profiler Workflow configuration: {err}"
            )
            raise err

    def execute(self):
        """Execute workflow"""
        logger.info("Starting data processor execution")
        self._execute_data_processor()
        logger.info("Data processor finished running")

        logger.info("Sleeping for 1 second. Waiting for ES data to be indexed.")
        time.sleep(1)
        logger.info("Starting KPI runner")
        self._execute_kpi_runner()
        logger.info("KPI runner finished running")

    def raise_from_status(self, raise_warnings=False):
        if self.data_processor and self.data_processor.get_status().failures:
            raise WorkflowExecutionError(
                "Source reported errors", self.data_processor.get_status()
            )
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())
        if raise_warnings and (
            (self.data_processor and self.data_processor.get_status().warnings)
            or self.sink.get_status().warnings
        ):
            raise WorkflowExecutionError(
                "Source reported warnings",
                self.data_processor.get_status() if self.data_processor else None,
            )

    def print_status(self) -> None:
        print_data_insight_status(self)

    def result_status(self) -> int:
        """
        Returns 1 if status is failed, 0 otherwise.
        """
        if (
            (self.data_processor and self.data_processor.get_status().failures)
            or self.status.failures
            or (hasattr(self, "sink") and self.sink.get_status().failures)
        ):
            return 1
        return 0

    def stop(self):
        """
        Close all connections
        """
        self.set_ingestion_pipeline_status(PipelineState.success)
        self.metadata.close()

    def set_ingestion_pipeline_status(self, state: PipelineState):
        """
        Method to set the pipeline status of current ingestion pipeline
        """
        pipeline_run_id = set_ingestion_pipeline_status_helper(
            state=state,
            ingestion_pipeline_fqn=self.config.ingestionPipelineFQN,
            pipeline_run_id=self.config.pipelineRunId,
            metadata=self.metadata,
        )
        self.config.pipelineRunId = pipeline_run_id
