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
Client to interact with SAP ERP APIs
"""

import math
import traceback
from typing import Any, List, Optional, Union

from metadata.generated.schema.entity.services.connections.database.sapErpConnection import (
    SapErpConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.database.saperp.constants import PARAMS_DATA
from metadata.ingestion.source.database.saperp.models import (
    SapErpColumn,
    SapErpColumnResponse,
    SapErpTable,
    SapErpTableResponse,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()

HEADERS = {"Accept": "*/*"}


class SapErpApiException(Exception):
    """
    Raise when API returns an error
    """


class SapErpClient:
    """
    Client to interact with SAP ERP APIs
    """

    def __init__(self, config: SapErpConnection):
        self.config: SapErpConnection = config
        self.auth_token = self.config.apiKey.get_secret_value()
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(config.hostPort),
            auth_header="APIKey",
            auth_token_mode="",
            auth_token=lambda: (self.auth_token, 0),
            api_version="v1",
            allow_redirects=True,
            retry_codes=[500, 504],
            retry_wait=2,
            verify=get_verify_ssl(config.sslConfig),
        )
        self.client = REST(client_config)

    def test_table_api(self):
        """
        Check metadata connection to SAS ERP tables API
        """
        params_data = PARAMS_DATA
        response_data = self.client._request(  # pylint: disable=protected-access
            method="GET",
            path="/ECC/DDIC/ZZ_I_DDIC_TAB_CDS/",
            headers=HEADERS,
            data=params_data,
        )
        if response_data:
            return response_data
        raise SapErpApiException(
            "Unable to fetch data from SAP ERP tables API check your connection."
        )

    def test_column_api(self):
        """
        Check metadata connection to SAP ERP columns API
        """
        params_data = PARAMS_DATA
        response_data = self.client._request(  # pylint: disable=protected-access
            method="GET",
            path="/ECC/DDIC/ZZ_I_DDIC_COL_CDS/",
            headers=HEADERS,
            data=params_data,
        )
        if response_data:
            return response_data
        raise SapErpApiException(
            "Unable to fetch data from SAP ERP columns API check your connection."
        )

    def paginate(
        self, api_url: str, params_data: dict, entities_per_page: int, model_class: Any
    ) -> List[Union[SapErpTable, SapErpColumn]]:
        """
        Method to paginate the APIs
        """
        entities_list = []
        params_data.update(PARAMS_DATA)
        response_data = self.client._request(  # pylint: disable=protected-access
            method="GET", path=api_url, headers=HEADERS, data=params_data
        )
        response = model_class(**response_data)
        count = response.d.count
        indexes = math.ceil(count / entities_per_page)
        for index in range(indexes):
            try:
                params_data.update(
                    {
                        "$top": str(entities_per_page),
                        "$skip": str(index * entities_per_page),
                    }
                )
                response_data = (
                    self.client._request(  # pylint: disable=protected-access
                        method="GET", path=api_url, headers=HEADERS, data=params_data
                    )
                )
                response = model_class(**response_data)
                entities_list.extend(response.d.results)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error fetching entities for pagination: {exc}")
        return entities_list

    def list_tables(self) -> Optional[List[SapErpTable]]:
        """
        List all tables on the SAP ERP instance
        """
        table_list = []
        params_data = {
            "$select": "tabname,tabclass,ddtext",
        }
        table_list = self.paginate(
            api_url="/ECC/DDIC/ZZ_I_DDIC_TAB_CDS/",
            params_data=params_data,
            entities_per_page=self.config.paginationLimit,
            model_class=SapErpTableResponse,
        )
        return table_list or None

    def list_columns(self, table_name: str) -> Optional[List[SapErpColumn]]:
        """
        List all the columns on the SAP ERP instance
        """
        try:
            logger.debug(f"Fetching columns for table {table_name}")
            params_data = {
                "$filter": f"tabname eq '{table_name}' and fieldname ne '.INCLUDE'"
            }
            table_columns = self.paginate(
                api_url="/ECC/DDIC/ZZ_I_DDIC_COL_CDS/",
                params_data=params_data,
                entities_per_page=self.config.paginationLimit,
                model_class=SapErpColumnResponse,
            )
            return table_columns or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching columns for table {table_name}: {exc}")
        return None
