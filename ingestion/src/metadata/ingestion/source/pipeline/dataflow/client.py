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
Client for Google Cloud Dataflow
"""
import json
from typing import Iterator, List, Optional

from google.api_core.gapic_v1.client_info import ClientInfo
from google.cloud import dataflow_v1beta3
from google.oauth2 import service_account

from metadata.generated.schema.entity.services.connections.pipeline.dataflowConnection import (
    DataflowConnection,
)
from metadata.generated.schema.security.credentials.gcpCredentials import (
    GcpCredentialsValues,
)
from metadata.ingestion.source.pipeline.dataflow.models import DataflowJob
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DATAFLOW_CLIENT_INFO = ClientInfo(user_agent="openmetadata-ingestion")


class DataflowClient:
    """
    Client to interact with Google Cloud Dataflow API
    """

    def __init__(self, connection: DataflowConnection):
        self.connection = connection
        self.project_id = connection.projectId
        self.region = connection.region

        credentials = self._get_credentials()
        self.jobs_client = dataflow_v1beta3.JobsV1Beta3Client(
            credentials=credentials, client_info=DATAFLOW_CLIENT_INFO
        )
        self.messages_client = dataflow_v1beta3.MessagesV1Beta3Client(
            credentials=credentials, client_info=DATAFLOW_CLIENT_INFO
        )
        self.metrics_client = dataflow_v1beta3.MetricsV1Beta3Client(
            credentials=credentials, client_info=DATAFLOW_CLIENT_INFO
        )

    def _get_credentials(self) -> service_account.Credentials:
        """Get GCP credentials from connection config"""
        gcp_credentials = self.connection.gcpConfig

        if isinstance(gcp_credentials, GcpCredentialsValues):
            if gcp_credentials.gcpConfig:
                credentials_dict = json.loads(
                    gcp_credentials.gcpConfig.get_secret_value()
                )
            else:
                credentials_dict = json.loads(
                    gcp_credentials.model_dump_json(exclude_none=True)
                )

            return service_account.Credentials.from_service_account_info(
                credentials_dict
            )

        raise ValueError("Invalid GCP credentials configuration")

    def list_jobs(
        self, location: Optional[str] = None, limit: Optional[int] = None
    ) -> Iterator[DataflowJob]:
        """
        List Dataflow jobs
        """
        try:
            request_location = location or self.region or "-"
            request = dataflow_v1beta3.ListJobsRequest(
                project_id=self.project_id,
                location=request_location,
            )

            page_result = self.jobs_client.list_jobs(request=request)
            count = 0

            for job in page_result:
                if limit and count >= limit:
                    break

                yield DataflowJob(
                    id=job.id,
                    name=job.name,
                    project_id=job.project_id,
                    location=job.location,
                    current_state=str(job.current_state),
                    type=str(job.type_),
                    create_time=str(job.create_time) if job.create_time else None,
                    start_time=str(job.start_time) if job.start_time else None,
                    labels=dict(job.labels) if job.labels else None,
                )
                count += 1

        except Exception as exc:
            logger.warning(f"Failed to list Dataflow jobs: {exc}")
            raise

    def get_job(self, job_id: str, location: Optional[str] = None) -> Optional[dict]:
        """
        Get detailed information about a specific Dataflow job
        """
        try:
            request_location = location or self.region or "-"
            request = dataflow_v1beta3.GetJobRequest(
                project_id=self.project_id,
                job_id=job_id,
                location=request_location,
                view=dataflow_v1beta3.JobView.JOB_VIEW_ALL,
            )

            job = self.jobs_client.get_job(request=request)
            return job

        except Exception as exc:
            logger.warning(f"Failed to get job {job_id}: {exc}")
            return None

    def list_job_messages(
        self, job_id: str, location: Optional[str] = None
    ) -> List[dict]:
        """
        List messages for a specific job (can contain lineage info)
        """
        try:
            request_location = location or self.region or "-"
            request = dataflow_v1beta3.ListJobMessagesRequest(
                project_id=self.project_id,
                job_id=job_id,
                location=request_location,
            )

            page_result = self.messages_client.list_job_messages(request=request)
            return list(page_result)

        except Exception as exc:
            logger.debug(f"Failed to list job messages for {job_id}: {exc}")
            return []
