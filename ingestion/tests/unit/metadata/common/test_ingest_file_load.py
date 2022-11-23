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
Validate how we are reading ingestion configs
"""
import os
from pathlib import Path
from unittest import TestCase, mock

from metadata.config.common import load_config_file


class TestIngestionFileLoad(TestCase):
    """Test class for the ingestion loading test"""

    resources_path = Path(__file__).parent.absolute() / "resources"

    @mock.patch.dict(
        os.environ,
        {
            "PROJECT_ID": "my-project-id",
            "KEY_PATH": "/random/path",
            "JWT_TOKEN": "jwt-token",
        },
        clear=True,
    )
    def test_load_env_vars(self):
        """Check that we are picking up the right env vars with different quoting marks"""
        config_file = self.resources_path / "bigquery.yaml"
        config_dict = load_config_file(config_file)

        self.assertEqual(config_dict["source"]["serviceName"], "bigquery_my-project-id")
        self.assertEqual(
            config_dict["source"]["sourceConfig"]["config"]["databaseFilterPattern"][
                "includes"
            ][0],
            "my-project-id",
        )
        self.assertEqual(
            config_dict["source"]["serviceConnection"]["config"]["credentials"][
                "gcsConfig"
            ],
            "/random/path",
        )
        self.assertEqual(
            config_dict["workflowConfig"]["openMetadataServerConfig"]["securityConfig"][
                "jwtToken"
            ],
            "jwt-token",
        )
