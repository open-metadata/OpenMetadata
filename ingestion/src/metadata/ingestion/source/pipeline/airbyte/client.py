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
Client to interact with airbyte apis
"""
import json
from typing import List

from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.ingestion.ometa.client import REST, APIError, ClientConfig
from metadata.utils.constants import AUTHORIZATION_HEADER, NO_ACCESS_TOKEN
from metadata.utils.credentials import generate_http_basic_token


class AirbyteClient:
    """
    Client handling API communication with Airbyte
    """

    def __init__(self, config: AirbyteConnection):
        self.config = config


        api_token = "eyJhbGciOiJIUzI1NiIsImV4cCI6MjAyMjU3MTQxMiwiaWF0IjoxNzA3MjExNDEyfQ.eyJhY2MiOiI1ZDdkZjg1NTZiMDI4ZTFiN2U3MzcyMjEiLCJzY29wZXMiOnsiNWQ3ZGY4NTU2YjAyOGUxYjdlNzM3MjI0IjpbInJpdmVyOmV4ZWN1dGUiLCJtZTpsaXN0IiwiZGF0YXNvdXJjZTpsaXN0IiwiZGF0YWZyYW1lOmxpc3QiLCJkYXRhX3F1YWxpdHlfdGVzdDpsaXN0IiwibG9naWNvZGU6bGlzdCIsIm9wZXJhdGlvbnM6bGlzdCIsImFjdGl2aXR5Omxpc3QiLCJlbnZpcm9ubWVudDpsaXN0IiwiYWNjb3VudDpsaXN0IiwiYXVkaXQ6bGlzdCIsImNvbm5lY3Rpb246bGlzdCIsInJpdmVyOmxpc3QiLCJhY3Rpdml0eTpsb2ciLCJncm91cDpsaXN0Il19LCJ0b2tlbl9uYW1lIjoib3Blbl9tZXRhZGF0YSIsImlzcyI6IjU1YzhiZTNjZjc0YzA3MTc2Yzk4YzVmMCIsImp0aSI6IjBmNjY0YjIwZGUyZTQzZGZiOWZkZDhmYTQwYzU4Mjg3IiwiZW52IjoiNWQ3ZGY4NTU2YjAyOGUxYjdlNzM3MjI0Iiwic3ViIjoiUml2ZXJ5IEFQSSJ9.Bi37UpFbLDLKYD3IyVXaM-Kw34nbohr0B4_-79mQlLg"
        client_config: ClientConfig = ClientConfig(
            base_url= self.config.hostPort,
            api_version=f"v1/accounts/{self.config.AccountID}",
            auth_header=  "Authorization",
            auth_token= lambda: (self.config.apiToken,0)
        )

        self.client = REST(client_config)

    def list_environments(self) -> List[dict]:
        """
        Method returns the list of environments
        """
        ACCOUNT_ID = '5d7df8556b028e1b7e737221'
        response = self.client.get(f"/environments")

        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("items",[])



    def list_connections(self, environment_id: str) -> List[dict]:
        """
        Method returns the list all of connections of workflow
        """
        ACCOUNT_ID = '5d7df8556b028e1b7e737221'
        # data = {"workspaceId": environment_id}
        response = self.client.get(f"/environments/{environment_id}/rivers")
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("items")

    def list_jobs(self, connection_id: str) -> List[dict]:
        """
        Method returns the list all of jobs of a connection
        """
        data = {"configId": connection_id, "configTypes": ["sync", "reset_connection"]}
        response = self.client.post("/jobs/list", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response.get("jobs")

    def get_source(self, source_id: str) -> dict:
        """
        Method returns source details
        """
        data = {"sourceId": source_id}
        response = self.client.post("/sources/get", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response

    def get_destination(self, destination_id: str) -> dict:
        """
        Method returns destination details
        """
        data = {"destinationId": destination_id}
        response = self.client.post("/destinations/get", data=json.dumps(data))
        if response.get("exceptionStack"):
            raise APIError(response["message"])
        return response
