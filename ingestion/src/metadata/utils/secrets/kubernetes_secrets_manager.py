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
Kubernetes Secrets Manager implementation
"""
import base64
import os
import traceback
from abc import ABC
from typing import Optional

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

from metadata.generated.schema.security.credentials.kubernetesCredentials import (
    KubernetesCredentials,
)
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import utils_logger
from metadata.utils.secrets.external_secrets_manager import (
    SECRET_MANAGER_AIRFLOW_CONF,
    ExternalSecretsManager,
    SecretsManagerConfigException,
)

logger = utils_logger()

secrets_manager_client_loader = enum_register()


def _get_current_namespace() -> str:
    """
    :return: The namespace where the application service account is running or default if it can't be retrieved
    """
    try:
        with open(
            "/var/run/secrets/kubernetes.io/serviceaccount/namespace", encoding="utf-8"
        ) as f:
            return f.read().strip()
    except Exception as _:
        logger.info(
            "Can't read the current namespace from in-cluster kubernetes. Is the service account configured?"
        )
    return "default"


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _() -> None:
    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _() -> Optional[KubernetesCredentials]:
    from airflow.configuration import conf

    namespace = conf.get(
        SECRET_MANAGER_AIRFLOW_CONF,
        "kubernetes_namespace",
        fallback=_get_current_namespace(),
    )
    in_cluster = conf.getboolean(
        SECRET_MANAGER_AIRFLOW_CONF, "kubernetes_in_cluster", fallback=False
    )
    kubeconfig_path = conf.get(
        SECRET_MANAGER_AIRFLOW_CONF, "kubernetes_kubeconfig_path", fallback=None
    )

    return KubernetesCredentials(
        namespace=namespace,
        inCluster=in_cluster,
        kubeconfigPath=kubeconfig_path,
    )


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _() -> Optional[KubernetesCredentials]:
    namespace = os.getenv("KUBERNETES_NAMESPACE", _get_current_namespace())
    in_cluster = os.getenv("KUBERNETES_IN_CLUSTER", "false").lower() == "true"
    kubeconfig_path = os.getenv("KUBERNETES_KUBECONFIG_PATH")

    return KubernetesCredentials(
        namespace=namespace,
        inCluster=in_cluster,
        kubeconfigPath=kubeconfig_path,
    )


class KubernetesSecretsManager(ExternalSecretsManager, ABC):
    """
    Kubernetes Secrets Manager class
    """

    def __init__(
        self,
        loader: SecretsManagerClientLoader,
    ):
        super().__init__(provider=SecretsManagerProvider.kubernetes, loader=loader)

        # Initialize Kubernetes client
        if self.credentials.inCluster:
            config.load_incluster_config()
            logger.info("Using in-cluster Kubernetes configuration")
        else:
            kubeconfig_path = self.credentials.kubeconfigPath
            if kubeconfig_path:
                config.load_kube_config(config_file=kubeconfig_path)
                logger.info(f"Using kubeconfig from path: {kubeconfig_path}")
            else:
                config.load_kube_config()
                logger.info("Using default kubeconfig")

        self.client = client.CoreV1Api()
        self.namespace = self.credentials.namespace or _get_current_namespace()
        logger.info(
            f"Kubernetes SecretsManager initialized with namespace: {self.namespace}"
        )

    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve
        :return: The value of the secret
        """
        try:

            # Get the secret from Kubernetes
            secret = self.client.read_namespaced_secret(
                name=secret_id, namespace=self.namespace
            )

            # Kubernetes stores secret data as base64 encoded
            if secret.data and "value" in secret.data:
                secret_value = base64.b64decode(secret.data["value"]).decode("utf-8")
                logger.debug(f"Got value for secret {secret_id}")
                return secret_value
            logger.warning(f"Secret {secret_id} exists but has no 'value' key")
            return None

        except ApiException as exc:
            if exc.status == 404:
                logger.debug(f"Secret {secret_id} not found")
                return None
            logger.debug(traceback.format_exc())
            logger.error(
                f"Could not get the secret value of {secret_id} due to [{exc}]"
            )
            raise exc
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Could not get the secret value of {secret_id} due to [{exc}]"
            )
            raise exc

    def load_credentials(self) -> Optional[dict]:
        """Load the provider credentials based on the loader type"""
        try:
            loader_fn = secrets_manager_client_loader.registry.get(self.loader.value)
            return loader_fn()
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")
