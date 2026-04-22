#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""ServiceAssert — database-service-level fluent checks."""

from __future__ import annotations

from typing import Literal

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .entity_assert import EntityAssert

_ENTITY_COUNT_LIMIT = 1000


class ServiceAssert(EntityAssert[DatabaseService]):
    """Service namespace — reached via OmClient.service(name).

    Provides smoke-level checks beyond the shared base: bulk entity counts.
    Inherits exists / get / eventually / has_description_containing.
    """

    _entity_cls = DatabaseService

    def _count_entities(self, kind: Literal["tables", "schemas"]) -> int:
        self._fetch()
        entity_cls = Table if kind == "tables" else DatabaseSchema
        items = list(
            self._om.list_all_entities(
                entity=entity_cls,
                limit=_ENTITY_COUNT_LIMIT,
                params={"service": self._fqn},
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

        Raises ValueError when `at_least` exceeds the list_all_entities cap
        (pagination is not implemented at this assertion level).
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
                    f"Service {self._fqn}: expected >= {at_least} {kind}, got {actual}"
                )

        self._eventually.run(_check, name=f"has_entity_count({kind},{at_least})")
