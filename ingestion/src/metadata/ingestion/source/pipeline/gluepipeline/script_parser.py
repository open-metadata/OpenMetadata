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
Regex-based parser for AWS Glue PySpark/GlueContext scripts to extract lineage.

Parses GlueContext DynamicFrame APIs and Spark DataFrame APIs to identify
source and target entities (S3 paths, Glue Catalog tables, JDBC tables).
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# --- GlueContext DynamicFrame Source Patterns ---

# create_dynamic_frame.from_catalog(database="db", table_name="tbl")
FROM_CATALOG_PATTERN = re.compile(
    r"create_dynamic_frame\.from_catalog\s*\((.*?)\)",
    re.DOTALL,
)

# create_dynamic_frame.from_options(connection_type="s3", ..., "paths": ["s3://..."])
FROM_OPTIONS_PATTERN = re.compile(
    r"create_dynamic_frame\.from_options\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)

# --- GlueContext DynamicFrame Target Patterns ---

# write_dynamic_frame.from_jdbc_conf(... catalog_connection="conn", ... "dbtable": "tbl")
WRITE_JDBC_CONF_PATTERN = re.compile(
    r"write_dynamic_frame\.from_jdbc_conf\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)

# write_dynamic_frame.from_options(connection_type="s3", ... "path": "s3://...")
WRITE_OPTIONS_PATTERN = re.compile(
    r"write_dynamic_frame\.from_options\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)

# write_dynamic_frame.from_catalog(database="db", table_name="tbl")
WRITE_CATALOG_PATTERN = re.compile(
    r"write_dynamic_frame\.from_catalog\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)

# purge_table(database="db", table_name="tbl")
PURGE_TABLE_PATTERN = re.compile(
    r"purge_table\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)

# --- Spark DataFrame Read Patterns ---

# spark.read.parquet("s3://..."), .json("s3://..."), .csv("s3://..."), .orc("s3://...")
SPARK_READ_FORMAT_PATTERN = re.compile(
    r"\.read\.(?:load|json|parquet|csv|orc|avro)\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# spark.read.format("...").load("s3://...")
SPARK_READ_FORMAT_LOAD_PATTERN = re.compile(
    r"\.read\.format\s*\([\"'][^\"']+[\"']\).*?\.load\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# spark.read.jdbc(url, table, ...) or .option("url",...).option("dbtable",...)
SPARK_READ_JDBC_PATTERN = re.compile(
    r"\.read\.jdbc\s*\(\s*[\"']?([^\"',]+)[\"']?\s*,\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# spark.read.table("db.table") or spark.table("db.table")
SPARK_READ_TABLE_PATTERN = re.compile(
    r"\.(?:read\.table|table)\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)

# --- Spark DataFrame Write Patterns ---

# df.write.parquet("s3://..."), .json("s3://..."), .csv("s3://..."), .orc("s3://...")
SPARK_WRITE_FORMAT_PATTERN = re.compile(
    r"\.write\.(?:parquet|json|csv|orc|avro)\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# df.write.format("...").save("s3://...")
SPARK_WRITE_FORMAT_SAVE_PATTERN = re.compile(
    r"\.write\.format\s*\([\"'][^\"']+[\"']\).*?\.save\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# df.write.jdbc(url, table, ...)
SPARK_WRITE_JDBC_PATTERN = re.compile(
    r"\.write\.jdbc\s*\(\s*[\"']?([^\"',]+)[\"']?\s*,\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)

# df.write.saveAsTable("db.table")
SPARK_WRITE_SAVEASTABLE_PATTERN = re.compile(
    r"\.write\.saveAsTable\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)

# df.write.insertInto("db.table")
SPARK_WRITE_INSERTINTO_PATTERN = re.compile(
    r"\.write\.insertInto\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)

# --- Helpers for extracting keyword arguments from function calls ---

S3_PATH_PATTERN = re.compile(r"s3[an]?://[^\s\"',\]\}]+")


def _extract_kwarg(block: str, key: str) -> Optional[str]:
    pattern = re.compile(
        rf'{key}\s*=\s*["\']([^"\']+)["\']',
    )
    match = pattern.search(block)
    return match.group(1) if match else None


def _extract_dict_value(block: str, key: str) -> Optional[str]:
    pattern = re.compile(
        rf'["\']?{key}["\']?\s*:\s*["\']([^"\']+)["\']',
    )
    match = pattern.search(block)
    return match.group(1) if match else None


def _extract_s3_paths(block: str) -> List[str]:
    return list(set(S3_PATH_PATTERN.findall(block)))


@dataclass
class CatalogRef:
    database: str
    table: str


@dataclass
class JDBCRef:
    connection_name: Optional[str] = None
    jdbc_url: Optional[str] = None
    database: Optional[str] = None
    table: Optional[str] = None


@dataclass
class ScriptLineageResult:
    s3_sources: List[str] = field(default_factory=list)
    s3_targets: List[str] = field(default_factory=list)
    catalog_sources: List[CatalogRef] = field(default_factory=list)
    catalog_targets: List[CatalogRef] = field(default_factory=list)
    jdbc_sources: List[JDBCRef] = field(default_factory=list)
    jdbc_targets: List[JDBCRef] = field(default_factory=list)

    @property
    def has_lineage(self) -> bool:
        return bool(
            self.s3_sources
            or self.s3_targets
            or self.catalog_sources
            or self.catalog_targets
            or self.jdbc_sources
            or self.jdbc_targets
        )


def parse_glue_script(source_code: str) -> ScriptLineageResult:
    result = ScriptLineageResult()
    if not source_code:
        return result

    _parse_glue_context_sources(source_code, result)
    _parse_glue_context_targets(source_code, result)
    _parse_spark_read(source_code, result)
    _parse_spark_write(source_code, result)

    logger.debug(
        f"Script lineage result: "
        f"s3_sources={result.s3_sources}, s3_targets={result.s3_targets}, "
        f"catalog_sources={len(result.catalog_sources)}, "
        f"catalog_targets={len(result.catalog_targets)}, "
        f"jdbc_sources={len(result.jdbc_sources)}, "
        f"jdbc_targets={len(result.jdbc_targets)}"
    )

    return result


def _parse_glue_context_sources(source_code: str, result: ScriptLineageResult):
    for match in FROM_CATALOG_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            database = _extract_kwarg(block, "database")
            table = _extract_kwarg(block, "table_name")
            if database and table:
                result.catalog_sources.append(CatalogRef(database=database, table=table))
                logger.debug(f"Found catalog source: {database}.{table}")
        except Exception as exc:
            logger.debug(f"Failed to parse from_catalog block: {exc}")

    for match in FROM_OPTIONS_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            conn_type = _extract_kwarg(block, "connection_type")
            if conn_type and conn_type.lower() == "s3":
                paths = _extract_s3_paths(block)
                result.s3_sources.extend(paths)
                for p in paths:
                    logger.debug(f"Found S3 source: {p}")
            elif conn_type and conn_type.lower() in ("jdbc", "mysql", "postgresql", "oracle", "redshift"):
                table = _extract_dict_value(block, "dbtable") or _extract_dict_value(
                    block, "dynamodb.input.tableName"
                )
                connection_name = _extract_kwarg(block, "catalog_connection") or _extract_kwarg(
                    block, "connection_name"
                )
                if table:
                    result.jdbc_sources.append(
                        JDBCRef(connection_name=connection_name, table=table)
                    )
        except Exception as exc:
            logger.debug(f"Failed to parse from_options block: {exc}")


def _parse_glue_context_targets(source_code: str, result: ScriptLineageResult):
    for match in WRITE_JDBC_CONF_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            connection_name = _extract_kwarg(block, "catalog_connection")
            table = _extract_dict_value(block, "dbtable")
            database = _extract_dict_value(block, "database")
            if table:
                result.jdbc_targets.append(
                    JDBCRef(
                        connection_name=connection_name,
                        database=database,
                        table=table,
                    )
                )
                logger.debug(
                    f"Found JDBC target: connection={connection_name}, "
                    f"database={database}, table={table}"
                )
        except Exception as exc:
            logger.debug(f"Failed to parse write_jdbc_conf block: {exc}")

    for match in WRITE_OPTIONS_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            conn_type = _extract_kwarg(block, "connection_type")
            if conn_type and conn_type.lower() == "s3":
                paths = _extract_s3_paths(block)
                result.s3_targets.extend(paths)
                for p in paths:
                    logger.debug(f"Found S3 target: {p}")
            elif conn_type:
                table = _extract_dict_value(block, "dbtable")
                connection_name = _extract_kwarg(block, "catalog_connection")
                if table:
                    result.jdbc_targets.append(
                        JDBCRef(connection_name=connection_name, table=table)
                    )
        except Exception as exc:
            logger.debug(f"Failed to parse write_options block: {exc}")

    for match in WRITE_CATALOG_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            database = _extract_kwarg(block, "database")
            table = _extract_kwarg(block, "table_name")
            if database and table:
                result.catalog_targets.append(CatalogRef(database=database, table=table))
                logger.debug(f"Found catalog target: {database}.{table}")
        except Exception as exc:
            logger.debug(f"Failed to parse write_catalog block: {exc}")

    for match in PURGE_TABLE_PATTERN.finditer(source_code):
        try:
            block = match.group(1)
            database = _extract_kwarg(block, "database")
            table = _extract_kwarg(block, "table_name")
            if database and table:
                result.catalog_targets.append(CatalogRef(database=database, table=table))
                logger.debug(f"Found purge_table target: {database}.{table}")
        except Exception as exc:
            logger.debug(f"Failed to parse purge_table block: {exc}")


def _parse_spark_read(source_code: str, result: ScriptLineageResult):
    for match in SPARK_READ_FORMAT_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):
            if path not in result.s3_sources:
                result.s3_sources.append(path)
                logger.debug(f"Found Spark read S3 source: {path}")

    for match in SPARK_READ_FORMAT_LOAD_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):
            if path not in result.s3_sources:
                result.s3_sources.append(path)
                logger.debug(f"Found Spark read.format().load() S3 source: {path}")

    for match in SPARK_READ_JDBC_PATTERN.finditer(source_code):
        try:
            jdbc_url = match.group(1).strip()
            table = match.group(2).strip()
            result.jdbc_sources.append(JDBCRef(jdbc_url=jdbc_url, table=table))
            logger.debug(f"Found Spark read.jdbc source: url={jdbc_url}, table={table}")
        except Exception as exc:
            logger.debug(f"Failed to parse spark.read.jdbc: {exc}")

    for match in SPARK_READ_TABLE_PATTERN.finditer(source_code):
        table_ref = match.group(1)
        parts = table_ref.split(".")
        if len(parts) == 2:
            result.catalog_sources.append(CatalogRef(database=parts[0], table=parts[1]))
        else:
            result.catalog_sources.append(CatalogRef(database="default", table=table_ref))
        logger.debug(f"Found Spark read.table source: {table_ref}")


def _parse_spark_write(source_code: str, result: ScriptLineageResult):
    for match in SPARK_WRITE_FORMAT_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):
            if path not in result.s3_targets:
                result.s3_targets.append(path)
                logger.debug(f"Found Spark write S3 target: {path}")

    for match in SPARK_WRITE_FORMAT_SAVE_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):
            if path not in result.s3_targets:
                result.s3_targets.append(path)
                logger.debug(f"Found Spark write.format().save() S3 target: {path}")

    for match in SPARK_WRITE_JDBC_PATTERN.finditer(source_code):
        try:
            jdbc_url = match.group(1).strip()
            table = match.group(2).strip()
            result.jdbc_targets.append(JDBCRef(jdbc_url=jdbc_url, table=table))
            logger.debug(f"Found Spark write.jdbc target: url={jdbc_url}, table={table}")
        except Exception as exc:
            logger.debug(f"Failed to parse df.write.jdbc: {exc}")

    for pattern in (SPARK_WRITE_SAVEASTABLE_PATTERN, SPARK_WRITE_INSERTINTO_PATTERN):
        for match in pattern.finditer(source_code):
            table_ref = match.group(1)
            parts = table_ref.split(".")
            if len(parts) == 2:
                result.catalog_targets.append(
                    CatalogRef(database=parts[0], table=parts[1])
                )
            else:
                result.catalog_targets.append(
                    CatalogRef(database="default", table=table_ref)
                )
            logger.debug(f"Found Spark saveAsTable/insertInto target: {table_ref}")
