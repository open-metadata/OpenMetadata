#  Copyright 2022 Collate
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
Test AWS SSM Secrets Manager
"""
import json
from abc import ABC
from typing import Any, Dict, List
from unittest.mock import Mock

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager
from metadata.utils.secrets.aws_ssm_secrets_manager import AWSSSMSecretsManager

from .test_aws_based_secrets_manager import AWSBasedSecretsManager


class TestAWSSecretsManager(AWSBasedSecretsManager.TestCase, ABC):
    def build_secret_manager(
        self,
        mocked_get_client: Mock,
        expected_json_1: Dict[str, Any],
        expected_json_2: Dict[str, Any] = None,
    ) -> AWSSSMSecretsManager:
        self.init_mocked_get_client(
            mocked_get_client, [expected_json_1, expected_json_2]
        )
        return AWSSSMSecretsManager(
            AWSCredentials(
                awsAccessKeyId="fake_key",
                awsSecretAccessKey="fake_access",
                awsRegion="fake-region",
            ),
            "openmetadata",
        )

    @staticmethod
    def init_mocked_get_client(
        get_client_mock: Mock, client_return: List[Dict[str, Any]]
    ):
        mocked_secret_manager = Mock()
        mocked_secret_manager.get_parameter = Mock(side_effect=client_return)
        get_client_mock.return_value = mocked_secret_manager

    @staticmethod
    def assert_client_called_once(
        aws_manager: AWSSecretsManager,
        expected_call_1: str,
        expected_call_2: str = None,
    ) -> None:
        expected_call = {"Name": expected_call_1, "WithDecryption": True}
        aws_manager.client.get_parameter.assert_any_call(**expected_call)
        if expected_call_2:
            expected_call = {"Name": expected_call_2, "WithDecryption": True}
            aws_manager.client.get_parameter.assert_any_call(**expected_call)

    @staticmethod
    def build_response_value(json_value: dict):
        return {"Parameter": {"Value": json.dumps(json_value)}}
