"""System settings SDK facade (glossary term relation types, etc.)."""

from __future__ import annotations

import json
from typing import Any, Optional, Union

from metadata.ingestion.ometa.client import APIError
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import OMetaClient  # noqa: TC001

GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings"
_SETTINGS_ENDPOINT = "/system/settings"
_MAX_REGISTRATION_ATTEMPTS = 3
_PATCH_TEST_FAILURE = "operation 'test' failed"


class Settings:
    """Facade for OpenMetadata system settings.

    Focused on glossary term relation types. Type registration uses an optimistic
    JSON Patch precondition so concurrent registration of the same name converges
    without creating duplicates.
    """

    _default_client: Optional[OMetaClient] = None  # noqa: UP045

    @classmethod
    def use_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:  # noqa: UP007
        """Register a default client for settings calls."""
        cls._default_client = client.ometa if isinstance(client, OpenMetadata) else client

    @classmethod
    def _get_rest_client(cls) -> Any:
        client = cls._default_client
        if client is None:
            client = OpenMetadata.get_default_client()
        rest_client = getattr(client, "client", None)
        if rest_client is None:
            raise RuntimeError("OpenMetadata client does not expose a REST interface")
        return rest_client

    # ------------------------------------------------------------------
    # Generic settings access
    # ------------------------------------------------------------------
    @classmethod
    def get(cls, name: str) -> dict[str, Any]:
        """Get a setting by name (e.g. ``glossaryTermRelationSettings``)."""
        return cls._get_rest_client().get(f"{_SETTINGS_ENDPOINT}/{name}")

    @classmethod
    def update(cls, settings: dict[str, Any]) -> dict[str, Any]:
        """Replace a setting wholesale via ``PUT`` (overwrites the whole config value)."""
        return cls._get_rest_client().put(_SETTINGS_ENDPOINT, data=json.dumps(settings))

    # ------------------------------------------------------------------
    # Glossary term relation types
    # ------------------------------------------------------------------
    @classmethod
    def glossary_relation_types(cls) -> list[dict[str, Any]]:
        """Return the configured glossary term relation types."""
        setting = cls.get(GLOSSARY_TERM_RELATION_SETTINGS) or {}
        config = setting.get("configValue") or setting.get("config_value") or {}
        return config.get("relationTypes", [])

    @classmethod
    def define_glossary_relation_type(
        cls,
        relation_type: dict[str, Any],
    ) -> Optional[dict[str, Any]]:  # noqa: UP045
        """Register a glossary term relation type.

        Sends a JSON Patch ``test`` for the current ``relationTypes`` array before
        appending. If another caller changes the setting first, the failed test
        triggers a bounded re-read. A concurrently registered matching name then
        becomes an idempotent no-op.

        Returns the updated settings, or ``None`` if the name already existed.
        """
        name = relation_type.get("name")
        if not name:
            raise ValueError("relation_type must include a 'name'")

        rest_client = cls._get_rest_client()
        attempts = 0
        while True:
            relation_types = cls.glossary_relation_types()
            if any(entry.get("name") == name for entry in relation_types):
                return None

            patch = [
                {"op": "test", "path": "/relationTypes", "value": relation_types},
                {"op": "add", "path": "/relationTypes/-", "value": relation_type},
            ]
            try:
                return rest_client.patch(
                    f"{_SETTINGS_ENDPOINT}/{GLOSSARY_TERM_RELATION_SETTINGS}",
                    data=json.dumps(patch),
                )
            except APIError as exc:
                attempts += 1
                if attempts >= _MAX_REGISTRATION_ATTEMPTS or not cls._is_relation_types_test_failure(exc):
                    raise

    @staticmethod
    def _is_relation_types_test_failure(error: APIError) -> bool:
        status_code = error.status_code or error.code
        if status_code in (409, 412):
            return True
        return status_code == 400 and _PATCH_TEST_FAILURE in str(error).casefold()
