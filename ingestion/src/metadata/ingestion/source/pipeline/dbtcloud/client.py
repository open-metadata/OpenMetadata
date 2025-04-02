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
        self, job_id: str = None, project_id: str = None
    ) -> Optional[List[DBTJob]]:
        """
        fetch jobs for an account in dbt cloud
        """
        job_list = []
        # we will get 100 jobs at a time
        query_params = {"offset": 0, "limit": 100}
        try:
            job_path = f"{job_id}/" if job_id else ""
            project_path = f"?project_id={project_id}" if project_id else ""
            result = self.client.get(
                f"/accounts/{self.config.accountId}/jobs/{job_path}{project_path}",
                data=query_params,
            )

            if job_id:
                job_list = [DBTJob.model_validate(result["data"])]
            else:
                job_list_response = DBTJobList.model_validate(result)
                job_list = job_list_response.Jobs

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
                    job_list.extend(job_list_response.Jobs)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to get job info for project_id: `{project_id}` or job_id: `{job_id}` : {exc}"
            )
        return job_list

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

    def get_jobs(self) -> Optional[List[DBTJob]]:
        """
        list jobs for an account in dbt cloud
        """
        try:
            jobs = []
            # case when job_ids are specified and project_ids are not
            if self.job_ids and not self.project_ids:
                for job_id in self.job_ids:
                    jobs.extend(self._get_jobs(job_id=job_id))
            # case when project_ids are specified or both are specified
            elif self.project_ids:
                for project_id in self.project_ids:
                    results = self._get_jobs(project_id=project_id)
                    if self.job_ids:
                        jobs.extend(
                            [
                                result
                                for result in results
                                if str(result.id) in self.job_ids
                            ]
                        )
                    else:
                        jobs.extend(results)
            else:
                results = self._get_jobs()
                jobs.extend(results)
            return jobs
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get job info :{exc}")

        return None

    def get_runs(self, job_id: int) -> Optional[List[DBTRun]]:
        """
        list runs for a job in dbt cloud
        """
        try:
            number_of_runs = self.config.numberOfRuns
            runs = []
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
            runs.extend(run_list_response.Runs)

            while (
                (number_of_runs is None or len(runs) < number_of_runs)
                and run_list_response.extra
                and run_list_response.extra.pagination
            ):
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
                runs.extend(run_list_response.Runs)

            return runs[:number_of_runs] if number_of_runs is not None else runs
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
                logger.debug(
                    f"Successfully fetched models from dbt for job_id:{job_id} run_id:{run_id}: {model_list}"
                )
                return model_list

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get model info :{exc}")
        return None

    def get_models_and_seeds_details(self, job_id: int, run_id: int):
        """
        get parent model details for a job in dbt cloud for lineage
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
                logger.debug(
                    f"Successfully fetched parent models from dbt for job_id:{job_id} run_id:{run_id}: {parents_list}"
                )
                return parents_list

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get parents model info :{exc}")
        return None
