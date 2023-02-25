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
Test Credentials helper module
"""
from unittest import TestCase

from pydantic import SecretStr

from metadata.generated.schema.security.credentials.gcsCredentials import GCSValues
from metadata.utils.credentials import (
    InvalidPrivateKeyException,
    build_google_credentials_dict,
)


class TestCredentials(TestCase):
    """
    Validate credentials handling
    """

    def test_build_google_credentials_dict(self):
        """
        Check how we can validate GCS values
        """

        # Key mocked online
        private_key = """-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDMGwM93kIt3D4r4+dWAGdoTboSaZcFLhsG1lvnZlYEpnZoFo1M
ek7laRKDUW3CkdTlSid9p4/RTs9SYKuuXvNKNSLApHUeR2zgKBIHYTGGv1t1bEWc
ohVeqr7w8HkFr9LV4qxgFEWBBd3QYncY/Y1iZgTtbmMiUxJN9vj/kuH0xQIDAQAB
AoGAPDqAY2JRrwy9v9/ZpPQrj4jYLpS//sRTL1pT9l2pZmfkquR0v6ub2nB+CQgf
VnoIE70lGBw5AS+7V/i00JiuO6GP/MWWqxKdc5McjBGYDIb+9gQ/DrryVDHsqgGX
iZrWr7rIrpGsbCB2xt2HPpKR7D9IpI8FA+EEU9fIPfETM6ECQQDv69L78zdijSNk
CYx70dVHqCiDZT5RbkJqDmQwKabIGXBqZLTM+7ZAHotq0EXGc5BvQGyIMso/qIOs
Wq3imi3dAkEA2ci4xEzj5guQcGxoVcxfGm+M/VqXLuw/eW1sYdOp52OwdDywxG+I
6tpm5ByVowhqT8PHDJVOy8GEV9QNw0Y4CQJBAJiyn/rJJlPr/j1aMnZP642KwhY2
pr4PDegQNsXMjKDISBr+82+POMSAbD1UR0RyItgbybe5k62GZB+bKxaRCGUCQEVj
l8MrwH0eeCHp2IBlwnN40VIz1/GiYkL9I0g0GXFZKPKQF74uz1AM0DWkCeVNHBpY
BYaz18xB1znonY33RIkCQQDE3wAWxFrvr582J12qJkE4enmNhRJFdcSREDX54d/5
VEhPQF0i0tUU7Fl071hcYaiQoZx4nIjN+NG6p5QKbl6k
-----END RSA PRIVATE KEY-----"""

        gcs_values = GCSValues(
            type="my_type",
            projectId=["project_id"],
            privateKeyId="private_key_id",
            privateKey=private_key,
            clientEmail="email@mail.com",
            clientId="client_id",
            clientX509CertUrl="http://localhost:1234",
        )

        expected_dict = {
            "type": "my_type",
            "project_id": ["project_id"],
            "private_key_id": "private_key_id",
            "private_key": private_key,
            "client_email": "email@mail.com",
            "client_id": "client_id",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "http://localhost:1234",
        }

        build_google_credentials_dict(gcs_values)

        self.assertEqual(expected_dict, build_google_credentials_dict(gcs_values))

        gcs_values.privateKey = SecretStr("I don't think I am a proper Private Key")

        with self.assertRaises(InvalidPrivateKeyException):
            build_google_credentials_dict(gcs_values)
