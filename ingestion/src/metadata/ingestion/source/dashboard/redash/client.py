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
REST Auth & Client for Redash
"""

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import utils_logger

logger = utils_logger()


class RedashApiClient:
    """
    REST Auth & Client for Redash
    """

    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=str(config.hostPort),
            api_version="",
            access_token=config.apiKey.get_secret_value(),
            auth_header="Authorization",
            auth_token_mode="Key",
            allow_redirects=True,
        )
        self.client = REST(client_config)

    def dashboards(self, page=1, page_size=25):
        """GET api/dashboards"""

        params_data = {"page": page, "page_size": page_size}
        return self.client.get(path="api/dashboards", data=params_data)

    def get_dashboard(self, slug):
        """GET api/dashboards/<slug>"""

        # The API changed from redash v9 onwards
        # legacy=true allows us to get the results in the old way
        return self.client.get(
            f"api/dashboards/{slug}?legacy=true",
        )

    def paginate(self, resource, page=1, page_size=25, **kwargs):
        """Load all items of a paginated resource"""

        response = resource(page=page, page_size=page_size, **kwargs)
        items = response["results"]

        if response["page"] * response["page_size"] >= response["count"]:
            return items
        return [
            *items,
            *self.paginate(resource, page=page + 1, page_size=page_size, **kwargs),
        ]
