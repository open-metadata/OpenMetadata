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
Module containing Azure Client (ADR:2026-11-13-azure-credentials-derive-sovereign-endpoints-from-suffix).
"""

from __future__ import annotations

import ipaddress
import re
from typing import TYPE_CHECKING, Any, ClassVar
from urllib.parse import urlsplit

from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.utils.logger import utils_logger

if TYPE_CHECKING:
    from collections.abc import Mapping

logger = utils_logger()

_DNS_LABEL_RE = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$")
_SYSTEM_CONTAINER_RE = re.compile(r"^\$[a-z0-9]{1,62}$")
_MULTI_LABEL_DOMAIN_RE = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$"
)


def _validate_multi_label_hostname(host: str, field_name: str) -> str:
    normalized = host.lower()
    if not normalized or len(normalized) > 253:
        raise ValueError(f"Invalid Azure {field_name}: '{host}'")

    try:
        ipaddress.ip_address(normalized.strip("[]"))
        is_ip_literal = True
    except ValueError:
        is_ip_literal = False

    if is_ip_literal:
        raise ValueError(f"Azure {field_name} must be a domain name, not an IP literal: '{host}'")

    if not _MULTI_LABEL_DOMAIN_RE.fullmatch(normalized) or normalized.rsplit(".", 1)[-1].isdigit():
        raise ValueError(f"Invalid Azure {field_name}: '{host}'")

    return normalized


class AzureClient:
    """
    AzureClient based on AzureCredentials.
    """

    DEFAULT_ENDPOINT_SUFFIX = "core.windows.net"

    SOVEREIGN_AUTHORITY_MAP: ClassVar[dict[str, str]] = {
        "core.usgovcloudapi.net": "https://login.microsoftonline.us",
        "core.chinacloudapi.cn": "https://login.chinacloudapi.cn",
    }

    SOVEREIGN_VAULT_SUFFIX_MAP: ClassVar[dict[str, str]] = {
        "core.windows.net": "vault.azure.net",
        "core.usgovcloudapi.net": "vault.usgovcloudapi.net",
        "core.chinacloudapi.cn": "vault.azure.cn",
    }

    def __init__(self, credentials: AzureCredentials | Mapping[str, Any]):
        self.credentials: AzureCredentials = (
            credentials if isinstance(credentials, AzureCredentials) else AzureCredentials.model_validate(credentials)
        )

    @classmethod
    def validate_resource_name(cls, raw_name: str | None, field_name: str) -> str:
        if raw_name is None or not raw_name.strip():
            raise ValueError(f"{field_name} is required")
        cleaned = raw_name.strip()
        if not _DNS_LABEL_RE.fullmatch(cleaned):
            raise ValueError(f"Invalid Azure {field_name}: '{raw_name}'")
        return cleaned

    @classmethod
    def validate_container_name(cls, raw_name: str | None) -> str:
        if raw_name is None or not raw_name.strip():
            raise ValueError("Container Name is required")
        cleaned = raw_name.strip()
        if not (_DNS_LABEL_RE.fullmatch(cleaned) or _SYSTEM_CONTAINER_RE.fullmatch(cleaned)):
            raise ValueError(f"Invalid Azure Container Name: '{raw_name}'")
        return cleaned

    @classmethod
    def resolve_endpoint_suffix(cls, raw_suffix: str | None) -> str:
        if raw_suffix is None:
            return cls.DEFAULT_ENDPOINT_SUFFIX
        cleaned = raw_suffix.strip()
        if not cleaned:
            return cls.DEFAULT_ENDPOINT_SUFFIX
        if cleaned.startswith("."):
            cleaned = cleaned[1:]
        return _validate_multi_label_hostname(cleaned, "endpointSuffix")

    @classmethod
    def resolve_authority(cls, endpoint_suffix: str, raw_authority: str | None) -> str | None:
        normalized_suffix = cls.resolve_endpoint_suffix(endpoint_suffix)
        if raw_authority is None or not raw_authority.strip():
            return cls.SOVEREIGN_AUTHORITY_MAP.get(normalized_suffix)

        cleaned = raw_authority.strip()
        if any(ch in cleaned for ch in ("?", "#", "@", "\\")) or any(ch.isspace() for ch in cleaned):
            raise ValueError("Invalid Azure authority host")

        candidate = cleaned if "://" in cleaned else f"https://{cleaned}"
        parsed = urlsplit(candidate)
        if parsed.scheme.lower() != "https":
            raise ValueError("Azure authority must use https")
        if (
            parsed.username is not None
            or parsed.password is not None
            or parsed.port is not None
            or ":" in parsed.netloc
        ):
            raise ValueError("Azure authority must not include credentials, ports, or IPv6 literals")
        if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError("Azure authority must be a hostname or origin without path or query")

        validated_host = _validate_multi_label_hostname(parsed.hostname or "", "authority")
        return f"https://{validated_host}"

    @classmethod
    def resolve_vault_suffix(cls, raw_suffix: str | None) -> str:
        normalized_suffix = cls.resolve_endpoint_suffix(raw_suffix)
        if normalized_suffix in cls.SOVEREIGN_VAULT_SUFFIX_MAP:
            return cls.SOVEREIGN_VAULT_SUFFIX_MAP[normalized_suffix]
        if normalized_suffix.startswith("core."):
            return f"vault.{normalized_suffix.removeprefix('core.')}"
        return f"vault.{normalized_suffix}"

    def create_client(self):
        from azure.identity import ClientSecretCredential, DefaultAzureCredential
        from msal.authority import WELL_KNOWN_AUTHORITY_HOSTS

        try:
            endpoint_suffix = self.resolve_endpoint_suffix(self.credentials.endpointSuffix)
            authority = self.resolve_authority(endpoint_suffix, self.credentials.authority)
            auth_kwargs: dict[str, Any] = {}
            if authority:
                auth_kwargs["authority"] = authority
                if (urlsplit(authority).hostname or "").lower() not in WELL_KNOWN_AUTHORITY_HOSTS:
                    # Custom/air-gapped Entra authorities otherwise trigger MSAL discovery
                    # against commercial login.microsoftonline.com on first token fetch.
                    auth_kwargs["disable_instance_discovery"] = True

            if self.credentials.tenantId and self.credentials.clientId and self.credentials.clientSecret:
                logger.info("Using Client Secret Credentials")
                return ClientSecretCredential(
                    tenant_id=self.credentials.tenantId,
                    client_id=self.credentials.clientId,
                    client_secret=self.credentials.clientSecret.get_secret_value(),
                    **auth_kwargs,
                )

            logger.info("Using Default Azure Credentials")
            return DefaultAzureCredential(**auth_kwargs)
        except Exception as exc:
            logger.error("Error creating Azure Client: %s", exc)
            raise

    def create_blob_client(self):
        from azure.storage.blob import BlobServiceClient

        try:
            logger.info("Creating Blob Service Client")
            account_name = self.validate_resource_name(
                self.credentials.accountName,
                "Account Name",
            )
            endpoint_suffix = self.resolve_endpoint_suffix(self.credentials.endpointSuffix)
            return BlobServiceClient(
                account_url=f"https://{account_name}.blob.{endpoint_suffix}/",
                credential=self.create_client(),
            )
        except Exception as exc:
            logger.error("Error creating Blob Service Client: %s", exc)
            raise

    def create_secret_client(self):
        from azure.keyvault.secrets import SecretClient

        try:
            vault_name = self.validate_resource_name(
                self.credentials.vaultName,
                "Vault Name",
            )
            vault_suffix = self.resolve_vault_suffix(self.credentials.endpointSuffix)
            logger.info("Creating Secret Client")
            return SecretClient(
                vault_url=f"https://{vault_name}.{vault_suffix}/",
                credential=self.create_client(),
            )
        except Exception as exc:
            logger.error("Error creating Secret Client: %s", exc)
            raise
