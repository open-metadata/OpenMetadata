#  Copyright 2024 Collate
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
Client to interact with Alation apis
"""

import json
import time
import traceback
from typing import Any

from metadata.generated.schema.entity.services.connections.metadata.alationSinkConnection import (
    AlationSinkConnection,
)
from metadata.generated.schema.security.credentials.apiAccessTokenAuth import (
    ApiAccessTokenAuth,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.auth_provider import AuthenticationProvider
from metadata.ingestion.ometa.client import APIError, ClientConfig, LimitsException, RestTransportError
from metadata.ingestion.source.metadata.alationsink.constants import (
    JOB_POLL_INITIAL_INTERVAL_SECONDS,
    JOB_POLL_MAX_INTERVAL_SECONDS,
    JOB_POLL_REQUEST_TIMEOUT_SECONDS,
    JOB_TIMEOUT_SECONDS,
    ROUTES,
    TOTAL_RECORDS,
    WRITE_BATCH_SIZE,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = utils_logger()


class AlationSinkAuthenticationProvider(AuthenticationProvider):
    """
    Module to Handle Alation Auth
    """

    def __init__(self, config: AlationSinkConnection):
        self.config = config
        self.service_connection = self.config
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="integration/v1",
            auth_token=lambda: ("no_token", 0),
            auth_header="Authorization",
            allow_redirects=True,
            verify=get_verify_ssl(config.sslConfig),
        )
        self.client = TrackedREST(client_config, source_name="alation")
        self.generated_auth_token = None
        self.expiry = None
        super().__init__()

    @classmethod
    def create(cls, config: AlationSinkConnection):
        return cls(config)

    def auth_token(self) -> None:
        """
        Generate the auth token
        """
        if isinstance(self.config.authType, ApiAccessTokenAuth):
            self.generated_auth_token = self.config.authType.accessToken.get_secret_value()
            self.expiry = 0
        else:
            self._get_access_token_from_basic_auth()

    def get_access_token(self):
        """
        Return the generated access token
        """
        self.auth_token()
        return self.generated_auth_token, self.expiry

    def _get_access_token_from_basic_auth(self):
        """
        Get the access token for basic auth type
        """
        # Get the refresh token
        refresh_token_data = {
            "username": self.config.authType.username,
            "password": self.config.authType.password.get_secret_value(),
            "name": self.config.projectName,
        }
        refresh_token_response = self.client.post("/createRefreshToken/", json.dumps(refresh_token_data))

        # Get the access token
        access_token_data = {
            "refresh_token": refresh_token_response["refresh_token"],
            "user_id": refresh_token_response["user_id"],
        }
        access_token_response = self.client.post("/createAPIAccessToken/", json.dumps(access_token_data))

        self.generated_auth_token = access_token_response["api_access_token"]
        self.expiry = 0


class AlationSinkClient:
    """
    Client to interact with Alation apis
    """

    def __init__(self, config: AlationSinkConnection):
        self.config = config
        self._auth_provider = AlationSinkAuthenticationProvider.create(config)
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        self.client = TrackedREST(self._client_config("integration", get_verify_ssl), source_name="alation")
        # The job status API lives outside the integration APIs. Its polls get a short read timeout and
        # no retries, so a single poll cannot hold a job's wait far past JOB_TIMEOUT_SECONDS
        self.jobs_client = TrackedREST(
            self._client_config("api/v1", get_verify_ssl, timeout=(10, JOB_POLL_REQUEST_TIMEOUT_SECONDS), retry=0),
            source_name="alation",
        )
        self.pagination_limit = self.config.paginationLimit
        self._sleep = time.sleep

    def _client_config(self, api_version: str, get_verify_ssl, **overrides) -> ClientConfig:
        return ClientConfig(
            base_url=clean_uri(str(self.config.hostPort)),
            auth_header="TOKEN",
            api_version=api_version,
            auth_token=self._auth_provider.get_access_token,
            auth_token_mode="",
            verify=get_verify_ssl(self.config.sslConfig),
            **overrides,
        )

    def paginate_entity(
        self,
        api_url: str,
        data: dict | None = None,
        is_key_offset: bool = False,
    ) -> list[Any] | None:
        """
        Method to paginate the entities
        """
        skip_key_name = "skip"
        if is_key_offset:
            skip_key_name = "offset"
        entities = []
        if not data:
            data = {}
        # get entities in batches using the offset and skip settings
        for offset in range(0, TOTAL_RECORDS, self.pagination_limit):
            data["limit"] = str(self.pagination_limit)
            data[skip_key_name] = str(offset)
            response_entities = self.client.get(api_url, data=data)

            # when there are no more entities all have been processed so break out of the loop
            if len(response_entities) == 0:
                break

            entities.extend(response_entities)

        return entities

    def list_native_datasources(self):
        """
        Method to list the native alation datasources
        """
        return self.paginate_entity(api_url="/v1/datasource/")

    def list_connectors(self):
        """
        Method to list all the connectors used by OCF data sources
        """
        response = self.client.get("/v2/connectors/")
        return {response_data["name"]: response_data["id"] for response_data in response}

    def write_entity(self, create_request: Any) -> Any | None:
        """
        Method to write the entity to Alation
        """
        try:
            url = f"/v2{ROUTES.get(type(create_request))}/"
            req = self.client.post(
                url,
                json=create_request.model_dump(exclude_none=True),
            )
            if req:
                logger.info(
                    f"Successfully wrote entity for [{ROUTES.get(type(create_request))}]: {create_request.title}"
                )
                return req
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to write entity: {exc}")
        return None

    def write_entities(self, ds_id: int, create_requests: Any) -> list[str]:
        """
        Method to write the entities to Alation, in batches, waiting for each batch's job to finish.
        Returns Alation's errors, empty when every entity was written
        """
        route = ROUTES[type(create_requests)]
        url = f"/v2{route}/"
        if ds_id:
            url = f"{url}?ds_id={ds_id}"
        entities = create_requests.root or []
        errors = []
        for start in range(0, len(entities), WRITE_BATCH_SIZE):
            batch = type(create_requests)(root=entities[start : start + WRITE_BATCH_SIZE])
            errors.extend(self._write_batch(url, route, batch))
        return errors

    def _write_batch(self, url: str, route: str, batch: Any) -> list[str]:
        entity_names = [create_request.key for create_request in batch.root]
        try:
            response = self.client.post(url, json=batch.model_dump(exclude_none=True)["root"])
            if not response:
                errors = ["Alation returned an empty response"]
            else:
                # A response without a job id was handled synchronously
                job_id = response.get("job_id") if isinstance(response, dict) else None
                errors = self._wait_for_job(job_id) if job_id else []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            errors = [str(exc)]
        if errors:
            logger.error("Failed to write entities for [%s] %s: %s", route, entity_names, errors)
        else:
            logger.info("Successfully wrote entities for [%s]: %s", route, entity_names)
        return errors

    def _wait_for_job(self, job_id: int) -> list[str]:
        """
        Poll an Alation job until it finishes. A job can succeed and still reject some of the
        objects it was given, which it lists under each result's `errors`
        """
        deadline = time.monotonic() + JOB_TIMEOUT_SECONDS
        interval = JOB_POLL_INITIAL_INTERVAL_SECONDS
        last_error = None
        # The deadline is checked before every poll, and no sleep runs past it
        while time.monotonic() < deadline:
            try:
                response = self.jobs_client.get("/bulk_metadata/job/", data={"id": job_id})
                job = response if isinstance(response, dict) else {}
            except Exception as exc:
                # Polls do not retry, so a transient failure is retried by the next poll; the job
                # itself may still succeed. Anything else would fail every poll, so stop now
                if not _is_transient(exc):
                    return [f"Polling Alation job [{job_id}] failed: {exc}"]
                logger.warning("Polling Alation job [%s] failed, polling again: %s", job_id, exc)
                last_error, job = exc, {}
            status = job.get("status")
            if status == "failed":
                return [f"Alation job [{job_id}] failed: {job.get('msg') or job.get('result')}"]
            if status == "successful":
                return [f"Alation job [{job_id}]: {error}" for error in _job_object_errors(job.get("result"))]
            self._sleep(max(min(interval, deadline - time.monotonic()), 0))
            interval = min(interval * 2, JOB_POLL_MAX_INTERVAL_SECONDS)
        suffix = f" (last poll error: {last_error})" if last_error else ""
        return [f"Alation job [{job_id}] did not finish within {JOB_TIMEOUT_SECONDS}s{suffix}"]


def _is_transient(exc: Exception) -> bool:
    """A poll failure the next poll can get past: transport, rate limit or a server-side error"""
    if isinstance(exc, (RestTransportError, LimitsException)):
        return True
    response = getattr(exc, "response", None)
    status_code = exc.status_code if isinstance(exc, APIError) else getattr(response, "status_code", None)
    return status_code is not None and status_code >= 500


def _job_object_errors(result: Any) -> list:
    results = result if isinstance(result, list) else [result]
    return [error for item in results if isinstance(item, dict) for error in item.get("errors") or []]
