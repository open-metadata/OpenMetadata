#  Copyright 2025 Collate
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
PowerBI REST Client
"""
import time
import traceback
from datetime import datetime, timedelta

import requests
from requests.exceptions import HTTPError

from metadata.ingestion.ometa.client import RetryException
from metadata.utils.logger import utils_logger

logger = utils_logger()


class PowerBIRequestsClient:
    def __init__(self, base_url, auth_token, retry_codes, retry, retry_wait):
        self.base_url = base_url
        self.auth_token = auth_token
        self.retry_codes = retry_codes
        self.retry = retry
        self.retry_wait = retry_wait

        self.access_token = None
        self.expires_on = None
        self.headers = {"Content-Type": "application/json"}
        self.validate_token()

    def generate_token(self):
        """Generate new token from callable method `auth_token`"""
        access_token, expires_in = self.auth_token()
        self.access_token = access_token
        expiration_time = datetime.now() + timedelta(seconds=expires_in)
        self.expires_on = expiration_time

    def validate_token(self):
        """Validate token before each request"""
        current_time = datetime.now()
        if (
            not self.expires_on
            or (current_time - timedelta(seconds=120)) > self.expires_on
        ):
            # Token is expired, generate new token
            self.generate_token()
            self.headers["Authorization"] = f"Bearer {self.access_token}"

    def get(self, endpoint, params=None):
        """Perform a GET request."""
        retry_codes = self.retry_codes
        total_retries = self.retry if self.retry > 0 else 0
        retry = total_retries

        while retry >= 0:
            try:
                url = f"{self.base_url}/{endpoint}"
                return self.get_request(url, params, retry, retry_codes)
            except RetryException:
                retry_wait = self.retry_wait * (total_retries - retry + 1)
                logger.warning(
                    "sleep %s seconds and retrying %s %s more time(s)...",
                    retry_wait,
                    url,
                    retry,
                )
                time.sleep(retry_wait)
                retry -= 1
                if retry == 0:
                    logger.error(f"No more retries left for {url}")
                    traceback.format_exc()
                    return None

    def get_request(self, url, params, retry, retry_codes):
        try:
            self.validate_token()
            response = requests.get(url, headers=self.headers, params=params)
            if response.status_code == 200:
                return response
            response.raise_for_status()
        except HTTPError as http_error:
            if response.status_code in retry_codes and retry > 0:
                raise RetryException() from http_error
            else:
                raise
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected error while calling the api={url}: {exc}")
        return None
