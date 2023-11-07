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
Workflow definition for the data insight
"""
from metadata.data_insight.processor.kpi.kpi_runner import KpiRunner
from metadata.data_insight.source.metadata import DataInsightSource
from metadata.generated.schema.analytics.basic import WebAnalyticEventType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.tests.testSuite import ServiceType
from metadata.ingestion.api.steps import Sink
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import get_beginning_of_day_timestamp_mill
from metadata.workflow.ingestion import IngestionWorkflow

logger = data_insight_logger()


class DataInsightWorkflow(IngestionWorkflow):
    """Data insight ingestion workflow implementation"""

    retention_days = 7

    def __init__(self, config: OpenMetadataWorkflowConfig):
        super().__init__(config)

        self.sink = None

    def _retrieve_service_connection_if_needed(self, service_type: ServiceType) -> None:
        """No service connection needed for data insight"""
        return None

    def _run_kpi_processor(self) -> None:
        """Run kpi processor. It will run as a step but as a post execution.
        We need the source to be executed first to compute the KPI results"""
        kpi_runner = KpiRunner(self.metadata)

        for kpi_result in kpi_runner.run():
            self.sink.run(kpi_result)

    def _clean_up_web_analytics_events(self) -> None:
        """
        We will delete web analytics events older than `cls.retention_days`
        to prevent storage explosion.
        TODO: deprecate to implement it with backend workflows
        """
        tmsp = get_beginning_of_day_timestamp_mill(days=self.retention_days)
        for web_analytic_event in WebAnalyticEventType:
            self.metadata.delete_web_analytic_event_before_ts_exclusive(
                web_analytic_event,
                tmsp,
            )

    def _get_sink(self) -> Sink:
        """Retrieve sink for data insight workflow"""
        sink_type = "metadata-rest"
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = {"api_endpoint": self.metadata_config.hostPort}
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink

    def _execute_internal(self):
        """Use parent logic and add step to process KPIs"""
        super().execute_internal()
        self._run_kpi_processor()
        self._clean_up_web_analytics_events()

    def set_steps(self):
        self.source = DataInsightSource.create(self.metadata)  # type: ignore

        self.sink = self._get_sink()
        self.steps = (self.sink,)
