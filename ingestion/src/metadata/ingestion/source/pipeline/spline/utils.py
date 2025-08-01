#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Spline source processing utilities
"""
import traceback
from typing import Optional, Tuple

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream

from metadata.generated.antlr.JdbcUriLexer import JdbcUriLexer
from metadata.generated.antlr.JdbcUriParser import JdbcUriParser
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


MULTI_DB_SOURCE = {"postgresql", "oracle:thin", "vertica", "redshift"}


def parse_dbfs_path(path: str) -> Optional[str]:
    try:
        return path.split("/")[-1]
    except Exception as exc:
        logger.warning(f"Failed to parse dbfs: {exc}")
        logger.error(traceback.format_exc())
    return None


def clean_name(name: str) -> Optional[str]:
    """
    replace empty string with None
    """
    if name:
        return name

    return None


def parse_jdbc_url(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Handle parsing of jdbc url to extract table, schema and database name
    """
    try:
        lexer = JdbcUriLexer(InputStream(url))
        stream = CommonTokenStream(lexer)
        parser = JdbcUriParser(stream)
        parser._errHandler = BailErrorStrategy()  # pylint: disable=protected-access
        tree = parser.jdbcUrl()
        schema_table = tree.schemaTable()
        if schema_table:
            table = (
                clean_name(schema_table.tableName().getText())
                if schema_table.tableName()
                else None
            )
            schema = (
                clean_name(schema_table.schemaName().getText())
                if schema_table.schemaName()
                else None
            )
        else:
            table, schema = None, None
        database = (
            clean_name(tree.databaseName().getText()) if tree.databaseName() else None
        )
        if tree.DATABASE_TYPE() and tree.DATABASE_TYPE().getText() in MULTI_DB_SOURCE:
            return database, schema, table

        return DEFAULT_DATABASE, database, table
    except Exception as exc:
        logger.warning(f"Failed to parse jdbc url: {exc}")
        logger.error(traceback.format_exc())

    return None, None, None
