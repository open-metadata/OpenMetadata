#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""StoredProcedureAssert — fluent assertions on stored procedure entities."""

from __future__ import annotations

from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure

from .entity_assert import EntityAssert


class StoredProcedureAssert(EntityAssert[StoredProcedure]):
    """Fluent assertions on a single stored procedure by FQN.

    Inherits exists / get / eventually / has_description_containing from
    EntityAssert; adds `has_code_containing` which reads the SP body.
    """

    _entity_cls = StoredProcedure

    def has_code_containing(self, text: str) -> StoredProcedureAssert:
        """Assert the stored procedure's SQL body contains the given substring."""

        def _check() -> None:
            sp = self._fetch()
            code = ""
            if sp.storedProcedureCode is not None and sp.storedProcedureCode.code is not None:
                code = sp.storedProcedureCode.code
            if text not in code:
                raise AssertionError(
                    f"StoredProcedure {self._fqn} code does not contain {text!r}. Actual code: {code!r}"
                )

        self._eventually.run(_check, name=f"has_code_containing({text!r})")
        return self
