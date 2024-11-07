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
Azure Datafactory Client
"""
import datetime
import traceback
from datetime import timezone
from typing import List, Optional

from azure.mgmt.datafactory import DataFactoryManagementClient
from azure.mgmt.datafactory.models import (
    DatasetResource,
    PipelineResource,
    PipelineRun,
    RunFilterParameters,
    RunQueryFilter,
)

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.pipeline.datafactoryConnection import (
    DataFactoryConnection,
)
from metadata.generated.schema.type.basic import SourceUrl
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class DataFactoryClient:
    """
    Wrapper on top of DataFactoryManagementClient
    """

    def __init__(self, config: DataFactoryConnection):
        self.config = config
        credential = AzureClient(self.config.configSource).create_client()
        self.client = DataFactoryManagementClient(
            credential=credential, subscription_id=self.config.subscription_id
        )

    def test_get_pipelines(self) -> List[PipelineResource]:
        """
        test fetch pipelines
        """
        pipelines = self.client.pipelines.list_by_factory(
            resource_group_name=str(self.config.resource_group_name),
            factory_name=str(self.config.factory_name),
        )
        return list(pipelines)

    def test_get_pipeline_runs(self) -> List[PipelineRun]:
        """
        test fetch pipeline runs
        """
        days = self.config.run_filter_days
        time_now = datetime.datetime.now()
        time_from = time_now - datetime.timedelta(days=days)
        filter_params = RunFilterParameters(
            last_updated_after=time_from, last_updated_before=time_now
        )
        pipeline_runs = self.client.pipeline_runs.query_by_factory(
            resource_group_name=self.config.resource_group_name,
            factory_name=self.config.factory_name,
            filter_parameters=filter_params,
        )

        return pipeline_runs.value

    def get_all_pipelines(self) -> Optional[List[PipelineResource]]:
        """
        Retrieves all pipelines in the Data Factory.
        """
        try:
            pipelines = self.client.pipelines.list_by_factory(
                self.config.resource_group_name, self.config.factory_name
            )
            return pipelines
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get pipeline info :{exc}")

        return None

    def get_pipeline_runs(self, pipeline_name: str) -> Optional[List[PipelineRun]]:
        """
        Retrieves run information for a pipeline .
        """
        try:
            days = self.config.run_filter_days
            time_now = datetime.datetime.now(timezone.utc)
            time_from = time_now - datetime.timedelta(days=days)
            filter_params = RunFilterParameters(
                last_updated_after=time_from,
                last_updated_before=time_now,
                filters=[
                    RunQueryFilter(
                        operand="PipelineName",
                        operator="Equals",
                        values=[str(pipeline_name)],
                    )
                ],
            )

            pipeline_runs = self.client.pipeline_runs.query_by_factory(
                resource_group_name=self.config.resource_group_name,
                factory_name=self.config.factory_name,
                filter_parameters=filter_params,
            )

            return pipeline_runs.value
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get pipeline run info :{exc}")

        return None

    def get_pipeline_url(self, pipeline_id: str) -> Optional[SourceUrl]:
        """
        Builds the pipeline url by its id run information for a pipeline .
        """
        try:
            pipeline_url = SourceUrl(
                f"https://portal.azure.com/#@{self.config.configSource.tenantId}/resource{pipeline_id}"
            )
            return pipeline_url
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get pipeline url :{exc}")

        return None

    def get_dataset_info(
        self, dataset_reference: str
    ) -> Optional[List[DatasetResource]]:
        """
        Retrieves dataset info in the Data Factory.
        """
        try:
            dataset = self.client.datasets.get(
                self.config.resource_group_name,
                self.config.factory_name,
                dataset_reference,
            )
            return dataset.properties
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get dataset info :{exc}")

        return None
