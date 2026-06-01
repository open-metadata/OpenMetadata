#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL dialect overrides for SqlBaselineEnforcer.

Adds stored-procedure listing via ``INFORMATION_SCHEMA.ROUTINES`` and
DROP+CREATE for procedures (MySQL lacks ``CREATE OR REPLACE PROCEDURE``).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy import create_engine, text

from ..core.source.sql_enforcer import SqlBaselineEnforcer

if TYPE_CHECKING:
    from sqlalchemy.engine import URL, Connection

    from ..core.source.sql import SqlSourceBaseline, StoredProcedureDefinition

logger = logging.getLogger(__name__)


class MySqlEnforcer(SqlBaselineEnforcer):
    _stored_procedure_query_sql = (
        "SELECT ROUTINE_SCHEMA, ROUTINE_NAME "
        "FROM INFORMATION_SCHEMA.ROUTINES "
        "WHERE ROUTINE_SCHEMA IN :schemas AND ROUTINE_TYPE = 'PROCEDURE'"
    )

    @classmethod
    def from_url(cls, url: str | URL, baseline: SqlSourceBaseline) -> MySqlEnforcer:
        """Construct with a SQLAlchemy engine built from a connection URL."""
        return cls(create_engine(url), baseline)

    def _apply_stored_procedure(self, conn: Connection, sp: StoredProcedureDefinition) -> None:
        logger.debug("[mysql] DROP+CREATE PROCEDURE %s.%s", sp.schema, sp.name)
        conn.execute(text(f"DROP PROCEDURE IF EXISTS {sp.schema}.{sp.name}"))
        conn.execute(text(sp.definition_sql))
