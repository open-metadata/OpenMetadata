"""System settings SDK facade (glossary term relation types, etc.)."""

from __future__ import annotations

import json
from typing import Any, Optional, Union

from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import OMetaClient  # noqa: TC001

GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings"
_SETTINGS_ENDPOINT = "/system/settings"


class Settings:
    """Facade for OpenMetadata system settings.

    Focused on glossary term relation types. Type registration appends via JSON
    Patch so concurrent callers never overwrite each other's relation types
    (unlike a full ``PUT`` that replaces the whole list).
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
        """Register a glossary term relation type (idempotent).

        Appends via JSON Patch so concurrent callers never clobber each other's
        relation types. If a type with the same ``name`` already exists this is a
        no-op that returns ``None``; otherwise it returns the updated settings.
        """
        name = relation_type.get("name")
        if not name:
            raise ValueError("relation_type must include a 'name'")
        existing = {entry.get("name") for entry in cls.glossary_relation_types()}
        result: Optional[dict[str, Any]] = None  # noqa: UP045
        if name not in existing:
            patch = [{"op": "add", "path": "/relationTypes/-", "value": relation_type}]
            result = cls._get_rest_client().patch(
                f"{_SETTINGS_ENDPOINT}/{GLOSSARY_TERM_RELATION_SETTINGS}",
                data=json.dumps(patch),
            )
        return result
