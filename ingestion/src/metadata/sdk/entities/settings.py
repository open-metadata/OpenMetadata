"""System settings SDK facade (glossary term relation types, etc.)."""

from __future__ import annotations

import json
from typing import Any, Optional, Union, cast

from metadata.ingestion.ometa.client import APIError
from metadata.sdk.client import OpenMetadata
from metadata.sdk.types import OMetaClient  # noqa: TC001

GLOSSARY_TERM_RELATION_SETTINGS = "glossaryTermRelationSettings"
_SETTINGS_ENDPOINT = "/system/settings"
_MAX_REGISTRATION_ATTEMPTS = 3
_MISSING_RELATION_TYPES = object()
_RECONCILABLE_REGISTRATION_STATUS_CODES = (400, 409, 412, 422)
_RETRYABLE_REGISTRATION_STATUS_CODES = (409, 412)


class Settings:
    """Facade for OpenMetadata system settings.

    Focused on glossary term relation types. Type registration preserves the
    server's missing, null, or array representation and reconciles a fresh
    snapshot after potential concurrent updates.
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
        relation_types, _, _ = cls._glossary_relation_types_snapshot()
        return relation_types

    @classmethod
    def _glossary_relation_types_snapshot(
        cls,
    ) -> tuple[list[dict[str, Any]], object, dict[str, Any]]:
        setting = cls.get(GLOSSARY_TERM_RELATION_SETTINGS) or {}
        config = setting.get("configValue") or setting.get("config_value") or {}
        if not isinstance(config, dict):
            raise TypeError("glossary relation settings must be a JSON object")
        raw_relation_types = config.get("relationTypes", _MISSING_RELATION_TYPES)
        if raw_relation_types is _MISSING_RELATION_TYPES or raw_relation_types is None:
            return [], raw_relation_types, config
        if not isinstance(raw_relation_types, list):
            raise TypeError("glossary relationTypes must be an array, null, or absent")
        return (
            cast("list[dict[str, Any]]", raw_relation_types),
            raw_relation_types,
            config,
        )

    @classmethod
    def define_glossary_relation_type(
        cls,
        relation_type: dict[str, Any],
    ) -> Optional[dict[str, Any]]:  # noqa: UP045
        """Register a glossary term relation type.

        Preserves the current ``relationTypes`` representation when building the
        patch. A 400 or 422 response is reconciled once, but retries only when
        the error identifies a failed JSON-Patch ``test`` operation. Explicit
        409 or 412 precondition failures may retry from a fresh snapshot. A
        concurrently registered matching name becomes an idempotent no-op.

        Returns the updated settings, or ``None`` if the name already existed.
        """
        name = relation_type.get("name")
        if not name:
            raise ValueError("relation_type must include a 'name'")

        rest_client = cls._get_rest_client()
        attempts = 0
        snapshot = cls._glossary_relation_types_snapshot()
        while True:
            relation_types, snapshot_value, config_snapshot = snapshot
            if any(entry.get("name") == name for entry in relation_types):
                return None

            patch = cls._build_relation_type_patch(
                snapshot_value,
                config_snapshot,
                relation_type,
            )
            try:
                return rest_client.patch(
                    f"{_SETTINGS_ENDPOINT}/{GLOSSARY_TERM_RELATION_SETTINGS}",
                    data=json.dumps(patch),
                )
            except APIError as exc:
                status_code = cls._registration_error_status(exc)
                if status_code not in _RECONCILABLE_REGISTRATION_STATUS_CODES:
                    raise
                latest_snapshot = cls._glossary_relation_types_snapshot()
                if any(entry.get("name") == name for entry in latest_snapshot[0]):
                    return None
                if not cls._is_retryable_registration_failure(exc, status_code) or latest_snapshot == snapshot:
                    raise
                attempts += 1
                if attempts >= _MAX_REGISTRATION_ATTEMPTS:
                    raise
                snapshot = latest_snapshot

    @staticmethod
    def _build_relation_type_patch(
        snapshot_value: object,
        config_snapshot: dict[str, Any],
        relation_type: dict[str, Any],
    ) -> list[dict[str, Any]]:
        if snapshot_value is _MISSING_RELATION_TYPES:
            return [
                {"op": "test", "path": "", "value": config_snapshot},
                {
                    "op": "add",
                    "path": "/relationTypes",
                    "value": [relation_type],
                },
            ]
        if snapshot_value is None:
            return [
                {"op": "test", "path": "/relationTypes", "value": None},
                {"op": "replace", "path": "/relationTypes", "value": [relation_type]},
            ]
        return [
            {"op": "test", "path": "/relationTypes", "value": snapshot_value},
            {"op": "add", "path": "/relationTypes/-", "value": relation_type},
        ]

    @staticmethod
    def _registration_error_status(error: APIError) -> int:
        return error.status_code or error.code

    @staticmethod
    def _is_retryable_registration_failure(error: APIError, status_code: int) -> bool:
        if status_code in _RETRYABLE_REGISTRATION_STATUS_CODES:
            return True
        if status_code not in (400, 422):
            return False
        message = str(error).casefold()
        identifies_test_operation = any(
            marker in message
            for marker in (
                "operation 'test'",
                'operation "test"',
                "test operation",
                "json patch test",
            )
        )
        return identifies_test_operation and any(marker in message for marker in ("fail", "mismatch", "did not match"))
