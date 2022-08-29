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
Test AWS Secrets Manager
"""
import json
from abc import ABC
from typing import Any, Dict
from unittest.mock import Mock

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager

from .test_aws_based_secrets_manager import AWSBasedSecretsManager


class TestAWSSecretsManager(AWSBasedSecretsManager.TestCase, ABC):
    def build_secret_manager(
        self, mocked_get_client: Mock, expected_json: Dict[str, Any]
    ) -> AWSSecretsManager:
        self.init_mocked_get_client(mocked_get_client, expected_json)
        return AWSSecretsManager(
            AWSCredentials(
                awsAccessKeyId="fake_key",
                awsSecretAccessKey="fake_access",
                awsRegion="fake-region",
            ),
            "openmetadata",
        )

    @staticmethod
    def init_mocked_get_client(
        get_client_mock: Mock, client_return: Dict[str, Any]
    ) -> None:
        mocked_secret_manager = Mock()
        mocked_secret_manager.get_secret_value = Mock(return_value=client_return)
        get_client_mock.return_value = mocked_secret_manager

    @staticmethod
    def assert_client_called_once(
        aws_manager: AWSSecretsManager, expected_call: str
    ) -> None:
        expected_call = {"SecretId": expected_call}
        aws_manager.client.get_secret_value.assert_called_once_with(**expected_call)

    @staticmethod
    def build_response_value(json_value: dict):
        return {"SecretString": json.dumps(json_value)}
