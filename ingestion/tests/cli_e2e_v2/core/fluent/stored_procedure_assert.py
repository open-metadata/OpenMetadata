#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""StoredProcedureAssert — fluent assertions on stored procedure entities."""

from __future__ import annotations

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class StoredProcedureAssert:
    """Fluent assertions on a single stored procedure identified by FQN."""

    def __init__(self, om: OpenMetadata, fqn: str) -> None:
        self._om = om
        self._fqn = fqn

    def _fetch(self) -> StoredProcedure:
        sp = self._om.get_by_name(entity=StoredProcedure, fqn=self._fqn)
        if sp is None:
            raise AssertionError(f"StoredProcedure not found: {self._fqn}")
        return sp

    def exists(self) -> None:
        """Synchronous — primary API is consistent immediately post-ingest."""
        self._fetch()

    def get(self) -> StoredProcedure:
        """Escape hatch — returns the raw Pydantic StoredProcedure entity."""
        return self._fetch()

    def has_description_containing(self, text: str) -> "StoredProcedureAssert":
        sp = self._fetch()
        desc = sp.description.root if sp.description else ""
        if text not in desc:
            raise AssertionError(
                f"StoredProcedure {self._fqn} description does not contain {text!r}. "
                f"Actual: {desc!r}"
            )
        return self

    def has_code_containing(self, text: str) -> "StoredProcedureAssert":
        """Assert the stored procedure's SQL body contains the given substring.

        The OM StoredProcedureCode model wraps the code in .code (a plain str).
        """
        sp = self._fetch()
        code = ""
        if sp.storedProcedureCode is not None:
            code_value = getattr(sp.storedProcedureCode, "code", None)
            if code_value is not None:
                code = code_value
        if text not in code:
            raise AssertionError(
                f"StoredProcedure {self._fqn} code does not contain {text!r}. "
                f"Actual code: {code!r}"
            )
        return self
