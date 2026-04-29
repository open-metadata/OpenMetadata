#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Fluent entry point wrapping the existing OpenMetadata HTTP client.

Per Decision #21 of the v2 spec, OmClient is a thin facade — we do NOT build
a new HTTP client. All actual REST calls delegate to
metadata.ingestion.ometa.OpenMetadata, which already handles auth, retries,
and Pydantic deserialization.

OmClient's public surface is the fluent layer: .table(fqn), .service(name),
.stored_procedure(fqn), plus .raw for escape-hatch tests that need the
underlying client directly.
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
