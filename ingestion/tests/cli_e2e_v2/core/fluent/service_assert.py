#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""ServiceAssert — database-service-level fluent checks."""

from __future__ import annotations

from typing import Literal

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .eventually import EventuallyRunner

_ENTITY_COUNT_LIMIT = 1000


class ServiceAssert:
    """Service namespace — reached via OmClient.service(name).

    Provides smoke-level checks: existence, bulk entity counts. Service-level
    operations are eventually-consistent (ingest completion doesn't guarantee
    every table is immediately queryable via list_all_entities), so
    has_entity_count supports `.eventually(timeout)`.
    """

    def __init__(self, om: OpenMetadata, name: str) -> None:
        self._om = om
        self._name = name
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "ServiceAssert":
        self._eventually.arm(timeout)
        return self

    def _fetch(self) -> DatabaseService:
        svc = self._om.get_by_name(entity=DatabaseService, fqn=self._name)
        if svc is None:
            raise AssertionError(f"Service not found: {self._name}")
        return svc

    def exists(self) -> None:
        self._fetch()

    def get(self) -> DatabaseService:
        return self._fetch()

    def _count_entities(self, kind: Literal["tables", "schemas"]) -> int:
        self._fetch()
        entity_cls = Table if kind == "tables" else DatabaseSchema
        items = list(
            self._om.list_all_entities(
                entity=entity_cls,
                limit=_ENTITY_COUNT_LIMIT,
                params={"service": self._name},
            )
        )
        return len(items)

    def has_entity_count(
        self,
        kind: Literal["tables", "schemas"],
        *,
        at_least: int,
    ) -> None:
        """Assert the service has at least `at_least` entities of `kind`.

        The underlying list call caps at limit=1000. `at_least` larger than
        that cap can't be verified reliably — raise at the call site so the
        ambiguity surfaces as a test error rather than a silent pass.
        """
        if at_least > _ENTITY_COUNT_LIMIT:
            raise ValueError(
                f"has_entity_count(at_least={at_least}) exceeds the "
                f"list_all_entities cap ({_ENTITY_COUNT_LIMIT}); pagination "
                f"is not implemented for this assertion."
            )

        def _check() -> None:
            actual = self._count_entities(kind)
            if actual < at_least:
                raise AssertionError(
                    f"Service {self._name}: expected >= {at_least} {kind}, got {actual}"
                )

        self._eventually.run(_check, name=f"has_entity_count({kind},{at_least})")
