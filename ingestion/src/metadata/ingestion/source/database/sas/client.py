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
Client to interact with SAS Viya apis
"""

import requests

from metadata.generated.schema.entity.services.connections.database.sasConnection import (
    SASConnection,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import APIError, ClientConfig
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()

SAS_CLI_AUTH_HEADER = "Basic c2FzLmNsaTo="


class SASClient:
    """
    Client to interact with SAS Information Catalog
    """

    def __init__(self, config: SASConnection):
        self.config: SASConnection = config
        verify = self._get_verify()
        self.auth_token = self.get_token(
            config.serverHost,
            config.username,
            config.password.get_secret_value(),
            verify=verify,
        )

        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(config.serverHost),
            auth_header="Authorization",
            auth_token=self.get_auth_token,
            api_version="",
            allow_redirects=True,
            verify=verify,
        )
        self.client = TrackedREST(client_config, source_name="sas")
        # custom setting
        self.enable_datatables = config.datatables
        self.custom_filter_datatables = config.dataTablesCustomFilter
        self.enable_reports = config.reports
        self.custom_filter_reports = config.reportsCustomFilter
        self.enable_dataflows = config.dataflows
        self.custom_filter_dataflows = config.dataflowsCustomFilter

    def _get_verify(self):
        """
        Helper to determine the SSL verification strategy
        """
        verify = True
        if self.config.verifySSL == VerifySSL.ignore:
            verify = False
        elif self.config.verifySSL == VerifySSL.no_ssl:
            verify = False
        elif self.config.verifySSL == VerifySSL.validate and self.config.sslConfig:
            try:
                verify = get_verify_ssl_fn(self.config.verifySSL)(self.config.sslConfig)
            except Exception:  # pylint: disable=broad-except
                verify = True
        return verify

    def check_connection(self):
        """
        Check metadata connection to SAS
        """
        check_list = []
        if self.enable_datatables:
            check_list.append("datasets")
        if self.enable_reports:
            check_list.append("reports")
        if self.enable_dataflows:
            check_list.append("dataflows")

        for asset in check_list:
            self.list_assets(asset)

    def get_instance(self, instance_id):
        endpoint = f"catalog/instances/{instance_id}"
        headers = {
            "Accept": "application/vnd.sas.metadata.instance.entity.detail+json",
        }
        response = self.client.get(path=endpoint, headers=headers)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        return response

    def get_information_catalog_link(self, instance_id):
        return f"{self.config.serverHost}SASInformationCatalog/details/~fs~catalog~fs~instances~fs~{instance_id}"

    def list_assets(self, assets):
        """
        Get all assets based on asset types
        """
        if assets == "datasets":
            enable_asset = self.enable_datatables
            asset_filter = self.custom_filter_datatables
        elif assets == "reports":
            enable_asset = self.enable_reports
            asset_filter = self.custom_filter_reports
        elif assets == "dataflows":
            enable_asset = self.enable_dataflows
            asset_filter = self.custom_filter_dataflows

        logger.debug(
            "Configuration for %s: enable %s - %s, custom %s filter - %s",
            assets,
            assets,
            enable_asset,
            assets,
            asset_filter,
        )
        endpoint = f"catalog/search?indices={assets}&q={asset_filter if str(asset_filter) != 'None' else '*'}"
        headers = {"Accept-Item": "application/vnd.sas.metadata.instance.entity+json"}
        response = self.client.get(path=endpoint, headers=headers)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        return response["items"]

    def get_views(self, query):
        endpoint = "catalog/instances"
        headers = {
            "Content-type": "application/vnd.sas.metadata.instance.query+json",
            "Accept": "application/json",
        }
        logger.info("%s", query)
        response = self.client.post(path=endpoint, data=query, headers=headers)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": "Error fetching views from SAS", "code": 0})
        return response

    def get_data_source(self, endpoint):
        headers = {
            "Accept-Item": "application/vnd.sas.data.source+json",
        }
        response = self.client.get(path=endpoint, headers=headers)
        logger.info("%s", response)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        return response

    def get_report_link(self, resource, uri):
        revised_uri = uri.replace("/", "%2F")
        endpoint = f"/links/resources/{resource}?uri={revised_uri}"
        return self.config.serverHost + endpoint

    def load_table(self, endpoint):
        self.client.put(path=endpoint, data={})

    def get_report_relationship(self, report_id):
        endpoint = f"reports/commons/relationships/reports/{report_id}"
        response = self.client.get(endpoint)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        dependencies = []
        for item in response["items"]:
            if item["type"] == "Dependent":
                dependencies.append(item)  # noqa: PERF401
        return dependencies

    def get_resource(self, endpoint):
        response = self.client.get(endpoint)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        return response

    def get_instances_with_param(self, data):
        endpoint = f"catalog/instances?{data}"
        response = self.client.get(endpoint)
        if response and isinstance(response, dict) and "error" in response:
            raise APIError({"message": response["error"], "code": 0})
        return response["items"]

    def get_auth_token(self):
        return self.auth_token, 0

    def get_token(self, base_url, user, password, verify=True):
        endpoint = "/SASLogon/oauth/token"
        payload = {"grant_type": "password", "username": user, "password": password}
        headers = {
            "Content-type": "application/x-www-form-urlencoded",
            "Authorization": SAS_CLI_AUTH_HEADER,
        }
        url = base_url + endpoint

        response = requests.request(
            "POST",
            url,
            headers=headers,
            data=payload,
            verify=verify,
            timeout=10,
        )
        logger.debug(
            "Token request for user: %s completed with status: %s",
            user,
            response.status_code,
        )
        try:
            body = response.json()
        except ValueError as exc:
            response.raise_for_status()
            raise RuntimeError(f"SAS token endpoint returned non-JSON response (HTTP {response.status_code})") from exc

        response.raise_for_status()
        token = body.get("access_token")
        if not token:
            raise RuntimeError(f"Failed to retrieve access_token from SAS (HTTP {response.status_code})")
        return token
