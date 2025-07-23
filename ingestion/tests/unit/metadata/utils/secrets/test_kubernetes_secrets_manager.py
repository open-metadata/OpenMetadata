#  Copyright 2025 Collate
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
Test Kubernetes Secrets Manager
"""
import base64
import os
from unittest import TestCase
from unittest.mock import MagicMock, patch

from kubernetes.client.exceptions import ApiException

from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.utils.secrets.kubernetes_secrets_manager import KubernetesSecretsManager
from metadata.utils.singleton import Singleton


class TestKubernetesSecretsManager(TestCase):
    """Test Kubernetes Secrets Manager"""

    def setUp(self) -> None:
        """Clear singleton instances before each test"""
        Singleton.clear_all()

    def tearDown(self) -> None:
        """Clear singleton instances after each test"""
        Singleton.clear_all()

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_init_in_cluster(self, mock_client, mock_config):
        """Test initialization with in-cluster config"""
        mock_core_v1_api = MagicMock()
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(
            os.environ,
            {
                "KUBERNETES_NAMESPACE": "test-namespace",
                "KUBERNETES_IN_CLUSTER": "true",
            },
        ):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Verify in-cluster config was loaded
            mock_config.load_incluster_config.assert_called_once()
            mock_config.load_kube_config.assert_not_called()

            # Verify namespace is set correctly
            self.assertEqual(secrets_manager.namespace, "test-namespace")

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_init_with_kubeconfig(self, mock_client, mock_config):
        """Test initialization with kubeconfig file"""
        mock_core_v1_api = MagicMock()
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(
            os.environ,
            {
                "KUBERNETES_NAMESPACE": "custom-namespace",
                "KUBERNETES_IN_CLUSTER": "false",
                "KUBERNETES_KUBECONFIG_PATH": "/path/to/kubeconfig",
            },
        ):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Verify kubeconfig was loaded with correct path
            mock_config.load_incluster_config.assert_not_called()
            mock_config.load_kube_config.assert_called_once_with(
                config_file="/path/to/kubeconfig"
            )

            # Verify namespace is set correctly
            self.assertEqual(secrets_manager.namespace, "custom-namespace")

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_get_string_value_success(self, mock_client, mock_config):
        """Test successful secret retrieval"""
        # Setup mock secret
        mock_secret = MagicMock()
        mock_secret.data = {"value": base64.b64encode(b"test-secret-value").decode()}

        # Setup mock client
        mock_core_v1_api = MagicMock()
        mock_core_v1_api.read_namespaced_secret.return_value = mock_secret
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(os.environ, {"KUBERNETES_NAMESPACE": "default"}):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Test retrieving secret
            result = secrets_manager.get_string_value("test-secret")

            # Verify API call
            mock_core_v1_api.read_namespaced_secret.assert_called_once_with(
                name="test-secret", namespace="default"
            )

            # Verify result
            self.assertEqual(result, "test-secret-value")

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_get_string_value_not_found(self, mock_client, mock_config):
        """Test secret not found returns None"""
        # Setup mock client to raise 404 error
        mock_core_v1_api = MagicMock()
        mock_core_v1_api.read_namespaced_secret.side_effect = (
            lambda **kwargs: self._raise_api_exception(404)
        )
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(os.environ, {"KUBERNETES_NAMESPACE": "default"}):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Test retrieving non-existent secret
            result = secrets_manager.get_string_value("non-existent-secret")

            # Verify result is None
            self.assertIsNone(result)

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_get_string_value_api_error(self, mock_client, mock_config):
        """Test API error is raised"""
        # Setup mock client to raise non-404 error
        mock_core_v1_api = MagicMock()
        mock_core_v1_api.read_namespaced_secret.side_effect = (
            lambda **kwargs: self._raise_api_exception(500)
        )
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(os.environ, {"KUBERNETES_NAMESPACE": "default"}):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Test retrieving secret with API error
            with self.assertRaises(ApiException):
                secrets_manager.get_string_value("test-secret")

    def _raise_api_exception(self, status):
        """Helper to raise ApiException with given status"""
        raise ApiException(status=status)

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_get_string_value_no_value_key(self, mock_client, mock_config):
        """Test secret without 'value' key returns None"""
        # Setup mock secret without 'value' key
        mock_secret = MagicMock()
        mock_secret.data = {"other-key": base64.b64encode(b"some-value").decode()}

        # Setup mock client
        mock_core_v1_api = MagicMock()
        mock_core_v1_api.read_namespaced_secret.return_value = mock_secret
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(os.environ, {"KUBERNETES_NAMESPACE": "default"}):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Test retrieving secret
            result = secrets_manager.get_string_value("test-secret")

            # Verify result is None
            self.assertIsNone(result)

    @patch("metadata.utils.secrets.kubernetes_secrets_manager.config")
    @patch("metadata.utils.secrets.kubernetes_secrets_manager.client")
    def test_get_string_value_with_special_characters(self, mock_client, mock_config):
        """Test that secret names with special characters are passed through to the backend"""
        # Setup mock secret
        mock_secret = MagicMock()
        mock_secret.data = {"value": base64.b64encode(b"test-value").decode()}

        # Setup mock client
        mock_core_v1_api = MagicMock()
        mock_core_v1_api.read_namespaced_secret.return_value = mock_secret
        mock_client.CoreV1Api.return_value = mock_core_v1_api

        with patch.dict(os.environ, {"KUBERNETES_NAMESPACE": "default"}):
            secrets_manager = KubernetesSecretsManager(
                loader=SecretsManagerClientLoader.env
            )

            # Test with name that contains special characters
            # The sanitization is now handled in the backend, so we pass the name as-is
            result = secrets_manager.get_string_value("test-secret-name")

            # Verify API was called with the original name (sanitization handled in backend)
            mock_core_v1_api.read_namespaced_secret.assert_called_once_with(
                name="test-secret-name", namespace="default"
            )

            # Verify result
            self.assertEqual(result, "test-value")
