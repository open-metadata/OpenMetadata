import requests

from metadata.generated.schema.entity.services.connections.metadata.sasConnection import (
    SASConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SASClient:
    """
    Client to interact with SAS Information Catalog
    """

    def __init__(self, config: SASConnection):
        self.config: SASConnection = config
        self.auth_token = get_token(
            config.serverHost, config.username, config.password.get_secret_value()
        )
        client_config: ClientConfig = ClientConfig(
            base_url=config.serverHost,
            auth_header="Authorization",
            auth_token=self.get_auth_token,
            api_version="",
            allow_redirects=True,
            verify=False,
        )
        self.client = REST(client_config)
        # custom setting
        self.enable_datatables = config.datatables
        self.custom_filter_datatables = config.dataTablesCustomFilter
        self.enable_reports = config.reports
        self.custom_filter_reports = config.reportsCustomFilter
        self.enable_dataflows = config.dataflows
        self.custom_filter_dataflows = config.dataflowsCustomFilter

    def check_connection(self):
        check_list = []
        if self.enable_datatables:
            check_list.append('datasets')
        if self.enable_reports:
            check_list.append('reports')
        if self.enable_dataflows:
            check_list.append('dataflows')

        for asset in check_list:
            self.list_assets(asset)
        return

    def get_instance(self, instanceId):
        endpoint = f"catalog/instances/{instanceId}"
        headers = {
            "Accept": "application/vnd.sas.metadata.instance.entity.detail+json",
        }
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response

    def get_information_catalog_link(self, instance_id):
        return f"{self.config.serverHost}/SASInformationCatalog/details/~fs~catalog~fs~instances~fs~{instance_id}"

    def list_assets(self, assets):
        if assets == 'datasets':
            enable_asset = self.enable_datatables
            asset_filter = self.custom_filter_datatables
        elif assets == 'reports':
            enable_asset = self.enable_reports
            asset_filter = self.custom_filter_reports
        elif assets == 'dataflows':
            enable_asset = self.enable_dataflows
            asset_filter = self.custom_filter_dataflows

        logger.debug(f"Configuration for {assets}: enable {assets} - {enable_asset}, "
                     f"custom {assets} filter - {asset_filter}")
        endpoint = (f"/catalog/search?indices={assets}&q="
                    f"{asset_filter if str(asset_filter) != 'None' else '*'}&limit=1000")
        headers = {"Accept-Item": "application/vnd.sas.metadata.instance.entity+json"}
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["items"]

    def get_report(self, report_id):
        endpoint = f"reports/reports/{report_id}"
        response = self.client.get(endpoint)
        if "error" in response.keys():
            return response

    def get_views(self, query):
        endpoint = "catalog/instances"
        headers = {
            "Content-type": "application/vnd.sas.metadata.instance.query+json",
            "Accept": "application/json",
        }
        logger.info(f"{query}")
        response = self.client._request(
            "POST", path=endpoint, data=query, headers=headers
        )
        if "error" in response.keys():
            raise APIError(f"{response}")
        logger.info("get_views success")
        return response

    def get_data_source(self, endpoint):
        headers = {
            "Accept-Item": "application/vnd.sas.data.source+json",
        }
        response = self.client._request("GET", path=endpoint, headers=headers)
        logger.info(f"{response}")
        if "error" in response.keys():
            raise APIError(response["error"])
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
        if "error" in response.keys():
            raise APIError(response["error"])
        dependencies = []
        for item in response["items"]:
            if item["type"] == "Dependent":
                dependencies.append(item)
        return dependencies

    def get_resource(self, endpoint):
        response = self.client.get(endpoint)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response

    def get_instances_with_param(self, data):
        endpoint = f"catalog/instances?{data}"
        response = self.client.get(endpoint)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["items"]

    def get_auth_token(self):
        return self.auth_token, 0


def get_token(baseURL, user, password):
    endpoint = "/SASLogon/oauth/token"
    payload = {"grant_type": "password", "username": user, "password": password}
    headers = {
        "Content-type": "application/x-www-form-urlencoded",
        "Authorization": "Basic c2FzLmNsaTo=",
    }
    url = baseURL + endpoint
    response = requests.request(
        "POST", url, headers=headers, data=payload, verify=False
    )
    text_response = response.json()
    logger.info(f"this is user: {user}, password: {password}, text: {text_response}")
    return response.json()["access_token"]
