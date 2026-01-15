import re
from typing import List, Optional

from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.source.dashboard.powerbi.models import Dataset
from metadata.utils.logger import ingestion_logger

NATIVE_QUERY_PARSER_EXPRESSION = re.compile(
    r"Value\.NativeQuery\(\s*"
    r"(?P<catalog_type>[A-Za-z0-9_\.]+)\s*\(\s*"
    r"(?P<catalog_info>.*?)\)\s*"
    r"(?P<catalog_parameters>\s*\{\s*\[.*?\]\s*\})\s*\[Data\],\s*"
    r'"(?P<query>.*?)"',
    re.DOTALL,
)
logger = ingestion_logger()


def resolve_database(database: str, dataset: Dataset) -> str:
    """
    Resolve the database name from the given input.
    If the database starts and ends with a single or double quote, it is hardcoded string, we just strip the quotes.
    othwerwise, it is a parameter defined in the expression section. Get the Default value of the expression.
    :param database: The input database string.
    :param dataset: The dataset object containing expressions.
    :return: The resolved database name.
    """
    regexp = r"^['\"].*['\"]$"

    if re.match(regexp, database):
        db_name = database.strip('"').strip('"').strip()
    else:
        db_name = None
        # get the database from the expression seciton of the workspace
        if dataset.expressions:
            for expr in dataset.expressions:
                if expr.name == database and expr.expression:
                    pattern = r'^"([^"]+)"\s+meta'
                    kw_match = re.search(pattern, expr.expression)
                    if kw_match:
                        db_name = kw_match.group(1)
    return db_name


def parse_databricks_native_query_source(
    source_expression: str,
    dataset: Dataset,
    parser_type: QueryParserType = QueryParserType.Auto,
) -> Optional[List[dict]]:
    # cleanup new lines and excessive spaces
    source_expression = source_expression.replace("\n", " ")
    source_expression = re.sub(r"\s+", " ", source_expression).strip()

    groups = NATIVE_QUERY_PARSER_EXPRESSION.search(source_expression)

    if groups:
        details = groups.groupdict()
        catalog_info = details.get("catalog_info", "")
        catalog_parameters = details.get("catalog_parameters", "")
        if catalog_info:
            catalog_info = catalog_info.replace("\n", " ")
            catalog_info = re.sub(r"\s+", " ", catalog_info).strip()
            catalog_info_match = re.search(
                r"\[\s?,?\s?Catalog\s?=\s?(?P<catalog>[^,\]\s]+)\s?,", catalog_info
            )
        if not catalog_info_match:
            logger.error(f"Could not find catalog in info: {catalog_info}")
            catalog = None
        else:
            catalog_groups = catalog_info_match.groupdict()
            catalog = catalog_groups.get("catalog", None)
        database_match = re.search(
            r'Name\s?=\s?(?P<database>[^,]+)\s?,\s?Kind\s?=\s?"Database"',
            catalog_parameters,
        )

        if database_match:
            database = database_match.groupdict().get("database", None)
        else:
            logger.error(f"Could not find database in parameters: {catalog_parameters}")
            database = catalog
        if not (database or catalog):
            logger.error(f"Could not find database in {source_expression}")
            return None

        database = resolve_database(database, dataset)
        parser_query = details.get("query")

        # Clean the query for parser

        # 2. Remove PowerBI line feed markers #(lf) and clean up the query
        parser_query = parser_query.replace("#(lf)", "\n")

        # 3. Remove SQL comments that might cause issues (// style comments)
        parser_query = re.sub(r"//[^\n]*", "", parser_query)

        # 4. Clean up excessive whitespace
        parser_query = re.sub(r"\s+", " ", parser_query).strip()

        logger.debug(
            f"Attempting LineageParser with cleaned query: {parser_query[:200]}"
        )
        if re.match(
            "^([A-Za-z0-9_]+)(?:\.([A-Za-z0-9_]+))?(?:\.([A-Za-z0-9_]+))?$",
            parser_query,
        ):
            logger.debug(
                "Query appears to be a simple table reference, skipping LineageParser."
            )
            schema_table = parser_query.split(".")
            schema, table = (
                schema_table[-2:] if len(schema_table) > 1 else [None, schema_table[0]]
            )

            return [{"database": database, "schema": schema, "table": table}]
        try:
            parser = LineageParser(
                parser_query,
                dialect=Dialect.DATABRICKS,
                timeout_seconds=30,
                parser_type=parser_type,
            )
            query_hash = parser.query_hash
            if parser.query_parsing_success is False:
                raise Exception(parser.query_parsing_failure_reason)
        except Exception as parser_exc:
            hash_prefix = f"[{query_hash}] " if "query_hash" in locals() else ""
            logger.error(
                f"{hash_prefix}LineageParser failed parsing query with error {parser_query[:200]} ",
                exc_info=parser_exc,
            )
            return None

        lineage_tables_list = []
        for source_table in parser.source_tables:
            lineage_tables_list.append(
                {
                    "database": database,
                    "schema": source_table.schema.raw_name,
                    "table": source_table.raw_name,
                }
            )
        return lineage_tables_list

    else:
        logger.error(
            f"Invalid Databricks Native Query Syntax: {source_expression} in dataset {dataset.name}[{dataset.id}]"
        )
        return None
