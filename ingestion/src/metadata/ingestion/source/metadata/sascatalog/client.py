import requests

from metadata.generated.schema.entity.services.connections.metadata.sasCatalogConnection import (
    SASCatalogConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SASCatalogClient:
    """
    Client to interact with SAS Catalog
    """

    def __init__(self, config: SASCatalogConnection):
        self.config = config
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

    def list_instances(self):
        # For now the entities we'll work with are tables in dataTables
        logger.info("list_instances")
        cas_table_id = "3a0d5d7b-a1c5-44c6-bfad-0d2174236172"
        sas_table_id = "02b7102c-e997-465d-9f41-2491c3a4f05b"
        extra_f = "contains(resourceId, 'dataTables')"
        filter_state = f"filter=and(or(eq(definitionId,'{cas_table_id}'),eq(definitionId,'{sas_table_id}')),{extra_f})"
        endpoint = f"catalog/instances?{filter_state}&limit=1"
        response = self.client.get(endpoint)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["items"]

    def get_instance(self, instanceId):
        endpoint = f"catalog/instances/{instanceId}"
        headers = {
            "Content-type": "application/vnd.sas.metadata.instance.entity.detail+json",
            "Accept": "application/vnd.sas.metadata.instance.entity.detail+json",
        }
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response

    def list_reports(self):
        report_id = "adc13e90-3fea-4d24-b612-4d83514ea965"
        filter_state = f"filter=eq(definitionId,'{report_id}')"
        filter_state = f"filter=contains(name, 'Water Consumption')"
        endpoint = f"catalog/instances?{filter_state}&limit=1"
        headers = {"Accept-Item": "application/vnd.sas.metadata.instance.entity+json"}
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["items"]

    def get_report(self, reportId):
        endpoint = f"reports/reports/{reportId}"
        response = self.client.get(endpoint)
        if "error" in response.keys():
            return response

    def list_data_plans(self):
        data_plan_id = "91eb73eb-6480-4e32-afe6-d7e9f1bc84e8"
        filter_state = f"filter=eq(definitionId, '{data_plan_id}')"
        filter_state = f"filter=contains(name, 'Water cluster')"
        endpoint = f"catalog/instances?{filter_state}&limit=1"
        headers = {"Accept-Item": "application/vnd.sas.metadata.instance.entity+json"}
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        items = response["items"]
        filtered_items = list(
            filter(lambda x: "/dataPlans/plans/" in x["resourceId"], items)
        )
        return filtered_items

    def list_data_flows(self):
        data_flow_id = "cc0df99e-3f91-468b-ab3f-866110fbda7f"
        filter_state = f"filter=eq(definitionId, '{data_flow_id}')"
        endpoint = f"catalog/instances?{filter_state}&limit=3"
        headers = {"Accept-Item": "application/vnd.sas.metadata.instance.entity+json"}
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["items"]

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

    def get_rows_cols(self, endpoint):
        # Retrieve resouceId attribute of table instance
        data_table = self.client.get(endpoint)
        if "error" in data_table.keys():
            raise APIError(data_table["error"])
        links = data_table["links"]
        rows_uri = None
        cols_uri = None
        load_uri = None
        for link in links:
            if rows_uri and load_uri and cols_uri:
                break
            if link["rel"] == "rows":
                rows_uri = link["uri"][1:]
            if link["rel"] == "load":
                load_uri = link["uri"][1:]
            if link["rel"] == "columns":
                cols_uri = link["uri"][1:] + "?limit=10000"
        if load_uri:
            self.load_table(load_uri)
        rows_resp = self.client.get(rows_uri)
        if "error" in rows_resp.keys():
            raise APIError(rows_resp["error"])
        rows_source = rows_resp["items"]
        rows = list(map(lambda x: x["cells"], rows_source))
        cols_resp = self.client.get(cols_uri)
        if "error" in cols_resp.keys():
            raise APIError(cols_resp["error"])
        cols = cols_resp["items"]
        col_names = list(map(lambda x: x["name"], cols))
        col_names_proper = list(map(lambda x: x.replace('"', "'"), col_names))
        return rows, col_names_proper, rows_resp["count"]

    def get_report_link(self, resource, uri):
        revised_uri = uri.replace("/", "%2F")
        endpoint = f"/links/resources/{resource}?uri={revised_uri}"
        return self.config.serverHost + endpoint

    def load_table(self, endpoint):
        headers = {"Content-type": "text/plain"}
        self.client._request("PUT", path=endpoint, headers=headers)

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

    def get_visual_elements(self, report_id):
        endpoint = f"reports/reports/{report_id}/content"
        headers = {"Accept": "application/vnd.sas.report.content+json"}
        response = self.client._request("GET", path=endpoint, headers=headers)
        if "error" in response.keys():
            raise APIError(response["error"])
        return response["visualElements"]

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
