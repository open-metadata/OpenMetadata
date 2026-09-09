#  Copyright 2026 Collate
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
OpenBao (and HashiCorp Vault) KV v2 secrets manager implementation
"""

import os
import traceback
from abc import ABC
from typing import TYPE_CHECKING, Optional

import requests

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

if TYPE_CHECKING:
    from metadata.generated.schema.security.credentials.openBaoCredentials import (
        OpenBaoCredentials,
    )

logger = utils_logger()

secrets_manager_client_loader = enum_register()

TOKEN_HEADER = "X-Vault-Token"
NAMESPACE_HEADER = "X-Vault-Namespace"
DEFAULT_MOUNT = "secret"
DEFAULT_AUTH_PATH = "approle"
# Requests takes (connect, read) seconds; the schema carries milliseconds to match the Java side.
DEFAULT_CONNECT_TIMEOUT_MS = 5000
DEFAULT_READ_TIMEOUT_MS = 10000


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _() -> None:
    # Unlike providers that can fall back to an ambient credential chain, OpenBao always needs an
    # address. Returning None here would surface much later as an AttributeError on `self.credentials`,
    # far from the misconfiguration that caused it.
    raise SecretsManagerConfigException(
        "The OpenBao Secrets Manager cannot be used with the `noop` client loader: it has no way to "
        "learn the server address. Set `secretsManagerLoader` to `airflow` or `env` and supply "
        "`openbao_address` / OPENBAO_ADDRESS."
    )


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _() -> Optional["OpenBaoCredentials"]:
    from airflow.configuration import conf

    from metadata.generated.schema.security.credentials.openBaoCredentials import (
        OpenBaoCredentials,
    )

    address = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_address", fallback=None)
    if not address:
        raise ValueError("Missing `openbao_address` config for the OpenBao Secrets Manager Provider.")

    # Built from a dict so Pydantic coerces the password fields into CustomSecretStr and the
    # auth method into its enum, rather than constructing those types by hand.
    return OpenBaoCredentials.model_validate(
        {
            "address": address,
            "mount": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_mount", fallback=DEFAULT_MOUNT),
            "namespace": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_namespace", fallback=None),
            "authMethod": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_auth_method", fallback="token"),
            "token": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_token", fallback=None),
            "roleId": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_role_id", fallback=None),
            "secretId": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_secret_id", fallback=None),
            "authPath": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_auth_path", fallback=DEFAULT_AUTH_PATH),
            "caCertPath": conf.get(SECRET_MANAGER_AIRFLOW_CONF, "openbao_ca_cert_path", fallback=None),
            "skipTlsVerify": conf.getboolean(SECRET_MANAGER_AIRFLOW_CONF, "openbao_skip_tls_verify", fallback=False),
            "connectTimeoutMs": conf.getint(SECRET_MANAGER_AIRFLOW_CONF, "openbao_connect_timeout_ms", fallback=5000),
            "readTimeoutMs": conf.getint(SECRET_MANAGER_AIRFLOW_CONF, "openbao_read_timeout_ms", fallback=10000),
        }
    )


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _() -> Optional["OpenBaoCredentials"]:
    from metadata.generated.schema.security.credentials.openBaoCredentials import (
        OpenBaoCredentials,
    )

    address = os.getenv("OPENBAO_ADDRESS")
    if not address:
        raise ValueError("Missing `OPENBAO_ADDRESS` config for the OpenBao Secrets Manager Provider.")

    return OpenBaoCredentials.model_validate(
        {
            "address": address,
            "mount": os.getenv("OPENBAO_MOUNT", DEFAULT_MOUNT),
            "namespace": os.getenv("OPENBAO_NAMESPACE"),
            "authMethod": os.getenv("OPENBAO_AUTH_METHOD", "token"),
            "token": os.getenv("OPENBAO_TOKEN"),
            "roleId": os.getenv("OPENBAO_ROLE_ID"),
            "secretId": os.getenv("OPENBAO_SECRET_ID"),
            "authPath": os.getenv("OPENBAO_AUTH_PATH", DEFAULT_AUTH_PATH),
            "caCertPath": os.getenv("OPENBAO_CA_CERT_PATH"),
            "skipTlsVerify": os.getenv("OPENBAO_SKIP_TLS_VERIFY", "false").lower() == "true",
            "connectTimeoutMs": int(os.getenv("OPENBAO_CONNECT_TIMEOUT_MS", "5000")),
            "readTimeoutMs": int(os.getenv("OPENBAO_READ_TIMEOUT_MS", "10000")),
        }
    )


class OpenBaoSecretsManager(ExternalSecretsManager, ABC):
    """
    Resolves `secret:` references against an OpenBao KV v2 engine.

    Also works against HashiCorp Vault, which shares the KV v2 paths and `X-Vault-*` headers.
    """

    def __init__(self, loader: SecretsManagerClientLoader):
        super().__init__(provider=SecretsManagerProvider.managed_openbao, loader=loader)

        self.address = str(self.credentials.address).rstrip("/")
        self.mount = (self.credentials.mount or DEFAULT_MOUNT).strip("/")
        self.namespace = self.credentials.namespace
        self.session = requests.Session()
        if self.credentials.skipTlsVerify:
            logger.warning(
                f"OpenBao TLS verification is DISABLED for {self.address}. "
                "Credentials are exposed in transit. Do not use this outside development."
            )
            self.session.verify = False
        elif self.credentials.caCertPath:
            self.session.verify = self.credentials.caCertPath
        self.timeout = (
            (self.credentials.connectTimeoutMs or DEFAULT_CONNECT_TIMEOUT_MS) / 1000,
            (self.credentials.readTimeoutMs or DEFAULT_READ_TIMEOUT_MS) / 1000,
        )
        self.token = self._authenticate()

    def _headers(self) -> dict:
        headers = {TOKEN_HEADER: self.token}
        # An empty namespace header is not the same as no namespace header - OSS servers reject it.
        if self.namespace:
            headers[NAMESPACE_HEADER] = self.namespace
        return headers

    def _is_approle(self) -> bool:
        # `authMethod` is a generated Enum, not a plain string.
        auth_method = getattr(self.credentials.authMethod, "value", self.credentials.authMethod) or "token"
        return str(auth_method).lower() == "approle"

    def _authenticate(self) -> str:
        if not self._is_approle():
            if not self.credentials.token:
                raise SecretsManagerConfigException("OpenBao `authMethod` is `token` but no token was supplied.")
            return str(self.credentials.token.get_secret_value())
        return self._login_with_approle()

    def _login_with_approle(self) -> str:
        # Validated before the request so a missing parameter is named, rather than surfacing as a
        # generic HTTP 400 from the login endpoint. Mirrors the Java client's requireParameter.
        for field, value in (("roleId", self.credentials.roleId), ("secretId", self.credentials.secretId)):
            if not value:
                raise SecretsManagerConfigException(
                    f"OpenBao `authMethod` is `approle` but `{field}` is missing or empty. Review your configuration."
                )
        auth_path = str(self.credentials.authPath or DEFAULT_AUTH_PATH).strip("/")
        url = f"{self.address}/v1/auth/{auth_path}/login"
        payload = {
            "role_id": self.credentials.roleId,
            "secret_id": str(self.credentials.secretId.get_secret_value()) if self.credentials.secretId else None,
        }
        # The login itself must carry the namespace: it is resolved per-namespace, so without this
        # a namespaced deployment authenticates against the root namespace and fails.
        headers = {NAMESPACE_HEADER: self.namespace} if self.namespace else None
        try:
            response = self.session.post(url, json=payload, headers=headers, timeout=self.timeout)
        except requests.RequestException as exc:
            raise SecretsManagerConfigException(
                f"Could not reach OpenBao at [{self.address}] to authenticate: {exc}"
            ) from exc
        if response.status_code != 200:
            raise SecretsManagerConfigException(
                f"OpenBao AppRole login at [{url}] failed with HTTP {response.status_code}. "
                "Check `roleId`, `secretId` and `authPath`."
            )
        token = response.json().get("auth", {}).get("client_token")
        if not token:
            raise SecretsManagerConfigException(f"OpenBao AppRole login at [{url}] returned no client_token")
        return token

    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve
        :return: The value of the secret

        Raises rather than returning None when the path does not resolve: handing a null credential
        back to a connector turns a configuration problem into a confusing connection failure later.
        """
        path = secret_id.lstrip("/")
        url = f"{self.address}/v1/{self.mount}/data/{path}"
        try:
            response = self.session.get(url, headers=self._headers(), timeout=self.timeout)
        except requests.RequestException as exc:
            logger.debug(traceback.format_exc())
            raise SecretsManagerConfigException(
                f"Could not reach OpenBao at [{self.address}] to read [{path}]: {exc}"
            ) from exc

        # A rejected token is worth exactly one retry. AppRole tokens are short-lived (the shipped
        # dev role uses token_ttl=20m), and an ingestion workflow easily outlives that. Without this
        # the 403 becomes a SecretsManagerConfigException that CustomSecretStr.get_secret_value
        # catches and logs, leaving the literal "secret:/..." reference as the password - so the
        # connector fails later with an unrelated authentication error.
        if response.status_code in (401, 403) and self._is_approle():
            logger.info("OpenBao rejected the token; re-authenticating once and retrying")
            self.token = self._authenticate()
            response = self.session.get(url, headers=self._headers(), timeout=self.timeout)

        if response.status_code == 200:
            value = response.json().get("data", {}).get("data", {}).get("value")
            if value is None:
                raise SecretsManagerConfigException(
                    f"OpenBao returned no `value` key for secret [{path}] on mount [{self.mount}]"
                )
            logger.debug(f"Got value for secret {secret_id}")
            return value

        raise SecretsManagerConfigException(
            f"Could not read secret [{path}] from OpenBao mount [{self.mount}] at [{self.address}]: "
            f"HTTP {response.status_code}"
        )

    def load_credentials(self) -> Optional["OpenBaoCredentials"]:
        """Load the provider credentials based on the loader type"""
        try:
            loader_fn = secrets_manager_client_loader.registry.get(self.loader.value)
            return loader_fn()
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")  # noqa: B904
