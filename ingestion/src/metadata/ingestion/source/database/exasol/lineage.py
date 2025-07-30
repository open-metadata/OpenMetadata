from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.database.exasol.queries import EXASOL_SQL_STATEMENT
from metadata.ingestion.source.database.exasol.query_parser import (
    ExasolQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ExasolLineageSource(ExasolQueryParserSource, LineageSource):
    """
    Exasol class for Lineage
    """

    dialect = Dialect.EXASOL
    sql_stmt = EXASOL_SQL_STATEMENT
    filters = """
        AND (
            s.command_name IN ('MERGE', 'UPDATE', 'CREATE TABLE AS', 'CREATE VIEW')
            OR (s.command_name = 'INSERT' AND LOWER(s.sql_text) LIKE '%insert%into%select%from%')
    )
    """
