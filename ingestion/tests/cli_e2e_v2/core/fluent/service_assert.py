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

from .eventually import retry_until


class ServiceAssert:
    """Service namespace — reached via OmClient.service(name).

    Provides smoke-level checks: existence, bulk entity counts. Service-level
    operations are eventually-consistent (ingest completion doesn't guarantee
    every table is immediately queryable via list_all_entities), so
    has_entity_count supports .eventually(timeout).
    """

    def __init__(self, om: OpenMetadata, name: str) -> None:
        self._om = om
        self._name = name
        self._eventually_timeout: int | None = None

    def eventually(self, timeout: int = 60) -> "ServiceAssert":
        self._eventually_timeout = timeout
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
        if kind == "tables":
            items = self._om.list_all_entities(
                entity=Table,
                limit=1000,
                params={"service": self._name},
            )
        else:
            items = self._om.list_all_entities(
                entity=DatabaseSchema,
                limit=1000,
                params={"service": self._name},
            )
        return sum(1 for _ in items)

    def has_entity_count(
        self,
        kind: Literal["tables", "schemas"],
        *,
        at_least: int,
    ) -> None:
        def _check() -> None:
            actual = self._count_entities(kind)
            if actual < at_least:
                raise AssertionError(
                    f"Service {self._name}: expected ≥ {at_least} {kind}, got {actual}"
                )

        if self._eventually_timeout is not None:
            retry_until(_check, timeout=self._eventually_timeout, name=f"has_entity_count({kind},{at_least})")
            self._eventually_timeout = None
        else:
            _check()
