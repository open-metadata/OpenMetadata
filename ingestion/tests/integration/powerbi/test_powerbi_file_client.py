#  Copyright 2024 Collate
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
PowerBI File Client tests
"""

import os
from unittest import TestCase

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import (
    PowerBiFileClient,
    _get_datamodel_schema_list,
)
from metadata.ingestion.source.dashboard.powerbi.models import (
    ConnectionFile,
    DataModelSchema,
    PowerBiColumns,
    PowerBiTable,
    RemoteArtifacts,
)

current_dir = os.getcwd()

powerbi_connection_config = {
    "type": "PowerBI",
    "clientId": "client_id",
    "clientSecret": "client_secret",
    "tenantId": "tenant_id",
    "scope": ["https://analysis.windows.net/powerbi/api/.default"],
    "pagination_entity_per_page": 100,
    "useAdminApis": False,
    "pbitFilesSource": {
        "pbitFileConfigType": "local",
        "path": f"{current_dir}/ingestion/tests/integration/powerbi/resources",
        "pbitFilesExtractDir": f"{current_dir}/ingestion/tests/integration/powerbi/resources/extracted",
    },
}

EXPECTED_DATAMODEL_MAPPINGS = [
    DataModelSchema(
        tables=[
            PowerBiTable(
                name="customers",
                columns=[
                    PowerBiColumns(
                        name="customer_id", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="first_name", dataType="string", columnType=None
                    ),
                    PowerBiColumns(
                        name="last_name", dataType="string", columnType=None
                    ),
                    PowerBiColumns(
                        name="first_order", dataType="dateTime", columnType=None
                    ),
                    PowerBiColumns(
                        name="most_recent_order", dataType="dateTime", columnType=None
                    ),
                    PowerBiColumns(
                        name="number_of_orders", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="customer_lifetime_value",
                        dataType="int64",
                        columnType=None,
                    ),
                ],
                description=None,
            ),
            PowerBiTable(
                name="DateTableTemplate_ec327b07-b020-4d43-80c5-516ece79b79d",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="LocalDateTable_d0a20cd6-9337-4c89-b71b-8a0e355f79d9",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="LocalDateTable_0e74d991-95ed-45b7-9817-97a7fb3e183d",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="orders",
                columns=[
                    PowerBiColumns(name="order_id", dataType="int64", columnType=None),
                    PowerBiColumns(
                        name="customer_id", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="order_date", dataType="dateTime", columnType=None
                    ),
                    PowerBiColumns(name="status", dataType="string", columnType=None),
                    PowerBiColumns(
                        name="credit_card_amount", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="coupon_amount", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="bank_transfer_amount", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="gift_card_amount", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(name="amount", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="LocalDateTable_26b94053-21b8-495a-b4f8-33287bd51f89",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
        ],
        connectionFile=ConnectionFile(
            RemoteArtifacts=[
                RemoteArtifacts(
                    DatasetId="c5bf4b57-1de4-4c7f-ae3a-b151f36a8260",
                    ReportId="3c8875f2-f68c-4d9a-bacb-4c4b6bf03a12",
                )
            ]
        ),
    ),
    DataModelSchema(
        tables=[
            PowerBiTable(
                name="customers_model",
                columns=[
                    PowerBiColumns(
                        name="customer_id", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="first_name", dataType="string", columnType=None
                    ),
                    PowerBiColumns(
                        name="last_name", dataType="string", columnType=None
                    ),
                    PowerBiColumns(
                        name="first_order", dataType="dateTime", columnType=None
                    ),
                    PowerBiColumns(
                        name="most_recent_order", dataType="dateTime", columnType=None
                    ),
                    PowerBiColumns(
                        name="number_of_orders", dataType="int64", columnType=None
                    ),
                    PowerBiColumns(
                        name="customer_lifetime_value",
                        dataType="int64",
                        columnType=None,
                    ),
                ],
                description=None,
            ),
            PowerBiTable(
                name="DateTableTemplate_7775cd0a-0160-433e-a83f-5f387c1bb939",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="LocalDateTable_fbc531ce-8c11-4307-a682-c6acc9d92305",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
            PowerBiTable(
                name="LocalDateTable_fe68b79b-3717-40a9-bd23-dd8aa62713b5",
                columns=[
                    PowerBiColumns(name="Date", dataType="dateTime", columnType=None),
                    PowerBiColumns(name="Year", dataType="int64", columnType=None),
                    PowerBiColumns(name="MonthNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Month", dataType="string", columnType=None),
                    PowerBiColumns(name="QuarterNo", dataType="int64", columnType=None),
                    PowerBiColumns(name="Quarter", dataType="string", columnType=None),
                    PowerBiColumns(name="Day", dataType="int64", columnType=None),
                ],
                description=None,
            ),
        ],
        connectionFile=ConnectionFile(
            RemoteArtifacts=[
                RemoteArtifacts(
                    DatasetId="a7026844-8de5-4419-b312-3162da41ff41",
                    ReportId="c9b7a5c2-ffaa-4411-a8e9-9099f584dbe9",
                )
            ]
        ),
    ),
]


class PowerBIFileClientTests(TestCase):
    """
    Check methods from powerbi/file_client.py
    """

    file_client = PowerBiFileClient(PowerBIConnection(**powerbi_connection_config))

    @pytest.mark.skip(reason="TODO: skip this until test is fixed")
    def test_parsing_pbit_files(self):
        """
        Test unzipping pbit files from local and extract the datamodels and connections
        """
        datamodel_mappings = _get_datamodel_schema_list(
            path=self.file_client.config.pbitFilesSource.path
        )
        for _, (expected, original) in enumerate(
            zip(EXPECTED_DATAMODEL_MAPPINGS, datamodel_mappings)
        ):
            self.assertEqual(expected, original)
