#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL dialect specifics for SqlBaselineEnforcer.

Introspection + table DDL (CREATE TABLE + FK + COMMENT) live in the base
via SQLAlchemy Inspector + `metadata.create_all`. This subclass supplies
only what Core doesn't model:
  - stored-procedure listing (`INFORMATION_SCHEMA.ROUTINES`)
  - DROP + CREATE for procedures (MySQL has no CREATE OR REPLACE PROCEDURE)
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Connection

from ..core.source.sql import SqlSourceBaseline, StoredProcedureDefinition
from ..core.source.sql_enforcer import SqlBaselineEnforcer

logger = logging.getLogger(__name__)


class MySqlEnforcer(SqlBaselineEnforcer):
    _stored_procedure_query_sql = (
        "SELECT ROUTINE_SCHEMA, ROUTINE_NAME "
        "FROM INFORMATION_SCHEMA.ROUTINES "
        "WHERE ROUTINE_SCHEMA IN :schemas AND ROUTINE_TYPE = 'PROCEDURE'"
    )

    @classmethod
    def from_url(cls, url: str | URL, baseline: SqlSourceBaseline) -> "MySqlEnforcer":
        """Construct with a SQLAlchemy engine built from a connection URL."""
        return cls(create_engine(url), baseline)

    def _apply_stored_procedure(self, conn: Connection, sp: StoredProcedureDefinition) -> None:
        logger.debug("[mysql] DROP+CREATE PROCEDURE %s.%s", sp.schema, sp.name)
        conn.execute(text(f"DROP PROCEDURE IF EXISTS {sp.schema}.{sp.name}"))
        conn.execute(text(sp.definition_sql))
