#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""OmClient — fluent entry point for E2E assertions.

Public surface: .table(fqn), .service(name), .stored_procedure(fqn).
.raw exposes the underlying OpenMetadata client for escape-hatch tests.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .service_assert import ServiceAssert
from .stored_procedure_assert import StoredProcedureAssert
from .table_assert import TableAssert

if TYPE_CHECKING:
    from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OmClient:
    def __init__(self, om: OpenMetadata) -> None:
        self._om = om

    @property
    def raw(self) -> OpenMetadata:
        return self._om

    def table(self, fqn: str) -> TableAssert:
        return TableAssert(self._om, fqn)

    def service(self, name: str) -> ServiceAssert:
        return ServiceAssert(self._om, name)

    def stored_procedure(self, fqn: str) -> StoredProcedureAssert:
        return StoredProcedureAssert(self._om, fqn)
