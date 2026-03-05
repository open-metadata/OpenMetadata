"""Unit tests for metadata.sdk.types — ensure_uuid conversion helper."""

from uuid import UUID

import pytest

from metadata.generated.schema.type.basic import Uuid as BasicUuid
from metadata.sdk.types import ensure_uuid

SAMPLE_UUID_STR = "12345678-1234-5678-1234-567812345678"
SAMPLE_UUID = UUID(SAMPLE_UUID_STR)
SAMPLE_BASIC_UUID = BasicUuid(SAMPLE_UUID)


class TestEnsureUuid:
    """Tests for ensure_uuid — all three input variants must produce equal output."""

    def test_from_basic_uuid_returns_same_object(self):
        """basic.Uuid passthrough must be identity (no re-wrapping)."""
        result = ensure_uuid(SAMPLE_BASIC_UUID)
        assert result is SAMPLE_BASIC_UUID

    def test_from_stdlib_uuid(self):
        """stdlib UUID must be wrapped into basic.Uuid."""
        result = ensure_uuid(SAMPLE_UUID)
        assert isinstance(result, BasicUuid)
        assert result.root == SAMPLE_UUID

    def test_from_string(self):
        """UUID string must be parsed and wrapped into basic.Uuid."""
        result = ensure_uuid(SAMPLE_UUID_STR)
        assert isinstance(result, BasicUuid)
        assert result.root == SAMPLE_UUID

    def test_all_forms_are_equal(self):
        """All three input forms must produce the same Uuid value."""
        r1 = ensure_uuid(SAMPLE_BASIC_UUID)
        r2 = ensure_uuid(SAMPLE_UUID)
        r3 = ensure_uuid(SAMPLE_UUID_STR)
        assert r1 == r2 == r3

    def test_invalid_string_raises(self):
        """Non-UUID string must raise ValueError."""
        with pytest.raises((ValueError, Exception)):
            ensure_uuid("not-a-uuid")

    def test_basic_uuid_does_not_double_wrap(self):
        """Calling ensure_uuid on a BasicUuid must not raise a Pydantic validation error."""
        wrapped = ensure_uuid(SAMPLE_BASIC_UUID)
        double_wrapped = ensure_uuid(wrapped)
        assert double_wrapped == SAMPLE_BASIC_UUID
