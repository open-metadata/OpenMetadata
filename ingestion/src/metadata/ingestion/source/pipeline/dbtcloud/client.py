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
Client to interact with DBT Cloud REST APIs
"""

import traceback
from typing import Iterable, List, Optional, Tuple

from metadata.generated.schema.entity.services.connections.pipeline.dbtCloudConnection import (
    DBTCloudConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.pipeline.dbtcloud.models import (
    DBTJob,
    DBTJobList,
    DBTModel,
    DBTModelList,
    DBTRun,
    DBTRunList,
)
from metadata.ingestion.source.pipeline.dbtcloud.queries import (
    DBT_GET_MODELS_WITH_LINEAGE,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()
API_VERSION = "api/v2"


class DBTCloudClient:
    """
    Wrapper on top of DBT cloud REST API
    """

    def __init__(self, config: DBTCloudConnection):
        self.config = config

        self.job_ids = self.config.jobIds
        self.project_ids = self.config.projectIds

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.host),
            api_version=API_VERSION,
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

    def _get_jobs(
        self,
        job_id: str = None,
        project_id: str = None,
    ) -> Iterable[DBTJob]:
        """
        Fetch jobs for an account in dbt cloud
        """
        query_params = {"offset": 0, "limit": 100}

        try:
            job_path = f"{job_id}/" if job_id else ""
            project_path = f"?project_id={project_id}" if project_id else ""
            result = self.client.get(
                f"/accounts/{self.config.accountId}/jobs/{job_path}{project_path}",
                data=query_params,
            )

            if job_id:
                yield DBTJob.model_validate(result["data"])
            else:
                job_list_response = DBTJobList.model_validate(result)
                yield from job_list_response.Jobs

                while job_list_response.extra and job_list_response.extra.pagination:
                    total_count = job_list_response.extra.pagination.total_count
                    current_count = job_list_response.extra.pagination.count

                    if current_count >= total_count:
                        break

                    query_params["offset"] += query_params["limit"]
                    result = self.client.get(
                        f"/accounts/{self.config.accountId}/jobs/{job_path}{project_path}",
                        data=query_params,
                    )
                    job_list_response = DBTJobList.model_validate(result)
                    yield from job_list_response.Jobs

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to get job info for project_id: `{project_id}` or job_id: `{job_id}` : {exc}"
            )

    def test_get_jobs(self) -> List[DBTJob]:
        """
        test fetch jobs for an account in dbt cloud
        """
        job_list = self.client.get(f"/accounts/{self.config.accountId}/jobs/")
        return DBTJobList.model_validate(job_list).Jobs

    def test_get_runs(self) -> List[DBTRun]:
        """
        test fetch runs for a job in dbt cloud
        """
        result = self.client.get(f"/accounts/{self.config.accountId}/runs/")
        run_list = DBTRunList.model_validate(result).Runs
        return run_list

    def get_jobs(self) -> Iterable[DBTJob]:
        """
        List jobs for an account in dbt cloud using generator pattern.
        yields job one at a time for memory efficiency.
        """
        try:
            # case when job_ids are specified and project_ids are not
            if self.job_ids and not self.project_ids:
                for job_id in self.job_ids:
                    yield from self._get_jobs(job_id=job_id)
            # case when project_ids are specified or both are specified
            elif self.project_ids:
                for project_id in self.project_ids:
                    for job in self._get_jobs(project_id=project_id):
                        if self.job_ids:
                            if str(job.id) in self.job_ids:
                                yield job
                        else:
                            yield job
            else:
                yield from self._get_jobs()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get job info :{exc}")

    def get_latest_successful_run_id(self, job_id: int) -> Optional[int]:
        """
        Get the latest successful run ID for a given job.
        """
        try:
            query_params = {
                "job_definition_id": job_id,
                "order_by": "-finished_at",
                "limit": "1",
                "status": "10",  # 10 = Success in dbt Cloud API
            }

            result = self.client.get(
                f"/accounts/{self.config.accountId}/runs/", data=query_params
            )
            run_list_response = DBTRunList.model_validate(result)

            if run_list_response.Runs:
                return run_list_response.Runs[0].id

            return None

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to get latest successful run for job {job_id}: {exc}"
            )
            return None

    def get_runs(self, job_id: int) -> Iterable[DBTRun]:
        """
        List runs for a job in dbt cloud using generator pattern.
        yields run one at a time for memory efficiency.
        """
        try:
            number_of_runs = self.config.numberOfRuns
            yielded_count = 0
            # we will get 100 runs at a time and order by created_at in descending order
            query_params = {
                "job_definition_id": job_id,
                "offset": 0,
                "limit": min(100, number_of_runs) if number_of_runs else 100,
                "order_by": "-created_at",
            }

            result = self.client.get(
                f"/accounts/{self.config.accountId}/runs/", data=query_params
            )
            run_list_response = DBTRunList.model_validate(result)

            for run in run_list_response.Runs or []:
                if number_of_runs is not None and yielded_count >= number_of_runs:
                    return
                yield run
                yielded_count += 1

            while run_list_response.extra and run_list_response.extra.pagination:
                if number_of_runs is not None and yielded_count >= number_of_runs:
                    return

                total_count = run_list_response.extra.pagination.total_count
                current_count = run_list_response.extra.pagination.count

                if current_count >= total_count:
                    break

                query_params["offset"] += query_params["limit"]
                result = self.client.get(
                    f"/accounts/{self.config.accountId}/runs/",
                    data=query_params,
                )
                run_list_response = DBTRunList.model_validate(result)

                for run in run_list_response.Runs or []:
                    if number_of_runs is not None and yielded_count >= number_of_runs:
                        return
                    yield run
                    yielded_count += 1

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get run info :{exc}")

    def get_models_with_lineage(
        self, job_id: int, run_id: int
    ) -> Tuple[
        Optional[List[DBTModel]], Optional[List[DBTModel]], Optional[List[DBTModel]]
    ]:
        """
        Get models with dependsOn and seeds in a single GraphQL call.
        """
        try:

            query_params = {
                "query": DBT_GET_MODELS_WITH_LINEAGE,
                "variables": {"jobId": job_id, "runId": run_id},
            }

            result = self.graphql_client.post("", json=query_params)

            if result.get("data") and result["data"].get("job"):
                model_list = DBTModelList.model_validate(result["data"]["job"])
                logger.debug(
                    f"Successfully fetched models and seeds from dbt for "
                    f"job_id:{job_id} run_id:{run_id}: "
                    f"models={len(model_list.models or [])}, seeds={len(model_list.seeds or [])}, sources={len(model_list.sources or [])}"
                )
                return model_list.models, model_list.seeds, model_list.sources

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get models with lineage info: {exc}")
        return None, None, None
