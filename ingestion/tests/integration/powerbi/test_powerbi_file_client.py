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
PowerBI File Client tests
"""

from pathlib import Path
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import (
    PowerBiFileClient,
    _get_datamodel_schema_list,
)

RESOURCES_DIR = Path(__file__).parent / "resources"

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
        "path": str(RESOURCES_DIR),
        "pbitFilesExtractDir": str(RESOURCES_DIR / "extracted"),
    },
}

EXPECTED_TABLE_NAMES = ["customers", "orders", "customers_model"]

EXPECTED_COLUMNS = {
    "customer_id",
    "first_name",
    "number_of_orders",
    "first_order",
    "last_name",
    "order_date",
    "credit_card_amount",
    "bank_transfer_amount",
    "amount",
    "gift_card_amount",
    "customer_lifetime_value",
    "order_id",
    "status",
    "coupon_amount",
    "most_recent_order",
}

EXPECTED_DATASET_IDS = [
    "c5bf4b57-1de4-4c7f-ae3a-b151f36a8260",
    "a7026844-8de5-4419-b312-3162da41ff41",
]

EXPECTED_REPORT_IDS = [
    "3c8875f2-f68c-4d9a-bacb-4c4b6bf03a12",
    "c9b7a5c2-ffaa-4411-a8e9-9099f584dbe9",
]


class PowerBIFileClientTests(TestCase):
    """
    Check methods from powerbi/file_client.py
    """

    file_client = PowerBiFileClient(PowerBIConnection(**powerbi_connection_config))

    def test_parsing_pbit_files(self):
        """
        Test unzipping pbit files from local and extract the datamodels and connections
        """
        datamodel_mappings = _get_datamodel_schema_list(
            path=self.file_client.config.pbitFilesSource.path
        )
        all_tables = []
        for schema in datamodel_mappings:
            # test the table and columns from the pbit file
            for table in schema.tables:
                if table.name in EXPECTED_TABLE_NAMES:
                    all_tables.append(table.name)
                    for column in table.columns:
                        self.assertIn(column.name, EXPECTED_COLUMNS)

            # test the connection objects from the pbit file
            for connection in schema.connectionFile.RemoteArtifacts:
                self.assertIn(connection.DatasetId, EXPECTED_DATASET_IDS)
                self.assertIn(
                    connection.ReportId,
                    EXPECTED_REPORT_IDS,
                )

        EXPECTED_TABLE_NAMES.sort()
        all_tables.sort()
        self.assertEqual(EXPECTED_TABLE_NAMES, all_tables)
