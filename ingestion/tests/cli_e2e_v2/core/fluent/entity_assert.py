#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared base for fluent entity-assertion classes.

`EntityAssert[T]` hoists the 20 lines of boilerplate every entity-assert
class shared into one place: the om/fqn/runner constructor, `_fetch()` +
`exists()` + `get()`, one-shot `.eventually(timeout)`, and the ubiquitous
`has_description_containing(text)` terminal.

Subclasses declare:
  - `_entity_cls: type[T]`   -- the OM Pydantic class (e.g. Table)
  - `_default_fields: list[str]` -- fields to request from the OM API

Entity-specific terminals (e.g. TableAssert.has_foreign_key_constraint,
ServiceAssert.has_entity_count, StoredProcedureAssert.has_code_containing)
stay on the subclass.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar, Generic, TypeVar

from metadata.ingestion.ometa.utils import model_str

from .eventually import EventuallyRunner

if TYPE_CHECKING:
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

T = TypeVar("T")


class EntityAssert(Generic[T]):
    """Base class carrying fluent terminals shared by every entity-assert."""

    _entity_cls: type[T]
    _default_fields: ClassVar[list[str]] = []

    def __init__(self, om: OpenMetadata, fqn: str) -> None:
        self._om = om
        self._fqn = fqn
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60):
        """One-shot: the next terminal polls until success/timeout."""
        self._eventually.arm(timeout)
        return self

    def _fetch(self, *, fields: list[str] | None = None) -> T:
        entity = self._om.get_by_name(
            entity=self._entity_cls,
            fqn=self._fqn,
            fields=fields if fields is not None else self._default_fields,
        )
        if entity is None:
            raise AssertionError(f"{self._entity_cls.__name__} not found: {self._fqn}")
        return entity

    def exists(self) -> None:
        """Synchronous — primary API is consistent immediately post-ingest."""
        self._fetch()

    def get(self) -> T:
        """Escape hatch — returns the raw Pydantic entity."""
        return self._fetch()

    def has_description_containing(self, text: str):
        def _check() -> None:
            entity = self._fetch()
            desc = model_str(entity.description) if entity.description else ""
            if text not in desc:
                raise AssertionError(
                    f"{self._entity_cls.__name__} {self._fqn} description does not contain {text!r}. Actual: {desc!r}"
                )

        self._eventually.run(_check, name=f"has_description_containing({text!r})")
        return self
