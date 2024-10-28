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
Client to interact with DBT Cloud REST APIs
"""

import traceback
from typing import List, Optional

from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.pipeline.dbtcloud.models import (
    DBTJob,
    DBTJobList,
    DBTModelList,
    DBTRun,
    DBTRunList,
)
from metadata.ingestion.source.pipeline.dbtcloud.queries import (
    DBT_GET_MODEL_DEPENDS_ON,
    DBT_GET_MODELS_SEEDS,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class DBTCloudClient:
    """
    Wrapper on top of DBT cloud REST API
    """

    def __init__(self, config: DBTCloudConnection):
        self.config = config
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.host),
            api_version="api/v2",
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
            allow_redirects=True,
        )

        graphql_client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.discoveryAPI),
            api_version="",
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
            allow_redirects=True,
        )

        self.client = REST(client_config)
        self.graphql_client = REST(graphql_client_config)

    def test_get_jobs(self) -> Optional[List[DBTJob]]:
        """
        test fetch jobs for an account in dbt cloud
        """
        job_path = f"{self.config.jobId}/" if self.config.jobId else ""
        result = self.client.get(f"/accounts/{self.config.accountId}/jobs/{job_path}")
        job_list = (
            [DBTJob.model_validate(result["data"])]
            if self.config.jobId
            else DBTJobList.model_validate(result).Jobs
        )
        return job_list

    def test_get_runs(self, job_id: int) -> Optional[List[DBTRun]]:
        """
        test fetch runs for a job in dbt cloud
        """
        result = self.client.get(
            f"/accounts/{self.config.accountId}/runs/",
            data={"job_definition_id": job_id},
        )
        run_list = DBTRunList.model_validate(result).Runs
        return run_list

    def get_jobs(self) -> Optional[List[DBTJob]]:
        """
        list jobs for an account in dbt cloud
        """
        try:
            job_path = f"{self.config.jobId}/" if self.config.jobId else ""
            result = self.client.get(
                f"/accounts/{self.config.accountId}/jobs/{job_path}"
            )
            if result:
                job_list = (
                    [DBTJob.model_validate(result.get("data"))]
                    if self.config.jobId
                    else DBTJobList.model_validate(result).Jobs
                )
                return job_list
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get job info :{exc}")

        return None

    def get_runs(self, job_id: int) -> Optional[List[DBTRun]]:
        """
        list runs for a job in dbt cloud
        """
        try:
            result = self.client.get(
                f"/accounts/{self.config.accountId}/runs/",
                data={"job_definition_id": job_id},
            )
            if result:
                run_list = DBTRunList.model_validate(result).Runs
                return run_list
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get run info :{exc}")

        return None

    def get_model_details(self, job_id: int, run_id: int):
        """
        get model details for a job in dbt cloud for lineage
        """
        try:
            query_params = {
                "query": DBT_GET_MODEL_DEPENDS_ON,
                "variables": {"jobId": job_id, "runId": run_id},
            }

            result = self.graphql_client.post("", json=query_params)

            if result.get("data") and result["data"].get("job"):
                model_list = DBTModelList.model_validate(result["data"]["job"]).models
                return model_list

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get model info :{exc}")
        return None

    def get_models_and_seeds_details(self, job_id: int, run_id: int):
        """
        get model details for a job in dbt cloud for lineage
        """
        try:
            query_params = {
                "query": DBT_GET_MODELS_SEEDS,
                "variables": {"jobId": job_id, "runId": run_id},
            }

            result = self.graphql_client.post("", json=query_params)

            if result.get("data") and result["data"].get("job"):
                result = DBTModelList.model_validate(result["data"]["job"])
                parents_list = result.models + result.seeds
                return parents_list

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get model info :{exc}")
        return None
