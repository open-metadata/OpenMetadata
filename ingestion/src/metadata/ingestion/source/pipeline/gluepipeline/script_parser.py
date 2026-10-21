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
source and target entities (S3 paths, Glue Catalog tables, JDBC tables,
Snowflake tables).
"""

import re
from dataclasses import dataclass, field

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

# --- Snowflake Patterns ---
# The Snowflake Spark connector is used either through GlueContext
# (connection_type="snowflake", handled in the from_options / write_options
# blocks) or directly with the DataFrame API:
#   spark.read.format("snowflake").options(**sf_options).option("dbtable", "T").load()
#   df.write.format("snowflake").options(**sf_options).option("dbtable", "T").mode("...").save()
# The database / schema usually live in a shared options dict (sfDatabase / sfSchema).

SNOWFLAKE_FORMATS = {"snowflake", "net.snowflake.spark.snowflake"}

# format() takes a literal or a name bound to one, as in the Snowflake docs.
# Any format matches here and _is_snowflake_format filters, so a chain must
# not run into the next read/write or a non-Snowflake one would swallow it.
#   SNOWFLAKE_SOURCE_NAME = "net.snowflake.spark.snowflake"
#   spark.read.format(SNOWFLAKE_SOURCE_NAME)...
SPARK_FORMAT_ARG = r"\.format\s*\(\s*(?:[\"']([^\"']+)[\"']|([A-Za-z_]\w*))\s*\)"

# Calls may sit on either side of format(): df.write.mode("append").format("snowflake")...save()
# Group 1 = chain before format(), 2/3 = format argument, 4 = chain after format().
_NOT_ANOTHER_STATEMENT = r"(?!\.read\s*\.|\.write\s*\.|\.load\s*\(|\.save\s*\()"

SPARK_READ_SNOWFLAKE_PATTERN = re.compile(
    rf"\.read\s*(?=\.)((?:{_NOT_ANOTHER_STATEMENT}.)*?){SPARK_FORMAT_ARG}((?:{_NOT_ANOTHER_STATEMENT}.)*?)\.load\s*\(",
    re.DOTALL,
)

SPARK_WRITE_SNOWFLAKE_PATTERN = re.compile(
    rf"\.write\s*(?=\.)((?:{_NOT_ANOTHER_STATEMENT}.)*?){SPARK_FORMAT_ARG}((?:{_NOT_ANOTHER_STATEMENT}.)*?)\.save\s*\(",
    re.DOTALL,
)

SNOWFLAKE_DATABASE_PATTERN = re.compile(r"[\"']sfDatabase[\"']\s*[:=]\s*[\"']([^\"']+)[\"']")
SNOWFLAKE_SCHEMA_PATTERN = re.compile(r"[\"']sfSchema[\"']\s*[:=]\s*[\"']([^\"']+)[\"']")


def _string_literal(name: str) -> str:
    """
    A complete Python string literal whose body is captured as `name`: triple or
    single quoted, escapes included, possibly empty. Reading strings whole keeps
    text inside them, such as SQL in .option("preactions", ...), from being
    scanned as option settings.
    """
    quote = f"{name}_quote"
    return rf"(?P<{quote}>\"\"\"|\'\'\'|\"|\')(?P<{name}>(?:\\.|(?!(?P={quote})).)*)(?P={quote})"


# Every way a Snowflake option is set, scanned in call order so a later setting
# wins as it does in Spark: .option("k", "v"), a "k": "v" dict entry, a k="v"
# keyword, and a shared dict passed as **name or connection_options=name. Any
# other string literal is consumed whole so nothing inside it counts as a setting.
OPTION_SETTER_PATTERN = re.compile(
    rf"option\s*\(\s*[\"'](?P<option_key>\w+)[\"']\s*,\s*{_string_literal('option_value')}"
    rf"|[\"'](?P<entry_key>\w+)[\"']\s*:\s*{_string_literal('entry_value')}"
    rf"|\b(?P<kwarg_key>\w+)\s*=\s*{_string_literal('kwarg_value')}"
    r"|(?:\*\*\s*|connection_options\s*=\s*)(?P<shared_name>[A-Za-z_]\w*)"
    rf"|{_string_literal('other_string')}",
    re.DOTALL,
)

# A backslash at the end of a line continues the statement: spark.read \\n .format(...)
LINE_CONTINUATION_PATTERN = re.compile(r"\\[ \t]*\r?\n")

# Snowflake identifiers: "ORDERS.V2" is one quoted name, FINANCE.CURATED.ORDERS are three
QUALIFIED_NAME_PART_PATTERN = re.compile(r'"[^"]*"|[^.]+')

# --- Helpers for extracting keyword arguments from function calls ---

S3_PATH_PATTERN = re.compile(r"s3[an]?://[^\s\"',\]\}]+")


def _extract_kwarg(block: str, key: str) -> str | None:
    pattern = re.compile(
        rf'{key}\s*=\s*["\']([^"\']+)["\']',
    )
    match = pattern.search(block)
    return match.group(1) if match else None


def _extract_dict_value(block: str, key: str) -> str | None:
    pattern = re.compile(
        rf'["\']?{key}["\']?\s*:\s*["\']([^"\']+)["\']',
    )
    match = pattern.search(block)
    return match.group(1) if match else None


def _extract_s3_paths(block: str) -> list[str]:
    return list(set(S3_PATH_PATTERN.findall(block)))


def _is_snowflake(connection_type: str | None) -> bool:
    return bool(connection_type) and connection_type.lower() == "snowflake"


@dataclass
class CatalogRef:
    database: str
    table: str


@dataclass
class JDBCRef:
    connection_name: str | None = None
    jdbc_url: str | None = None
    database: str | None = None
    table: str | None = None


@dataclass
class SnowflakeRef:
    table: str
    database: str | None = None
    schema: str | None = None


@dataclass
class ScriptLineageResult:
    s3_sources: list[str] = field(default_factory=list)
    s3_targets: list[str] = field(default_factory=list)
    catalog_sources: list[CatalogRef] = field(default_factory=list)
    catalog_targets: list[CatalogRef] = field(default_factory=list)
    jdbc_sources: list[JDBCRef] = field(default_factory=list)
    jdbc_targets: list[JDBCRef] = field(default_factory=list)
    snowflake_sources: list[SnowflakeRef] = field(default_factory=list)
    snowflake_targets: list[SnowflakeRef] = field(default_factory=list)

    @property
    def has_lineage(self) -> bool:
        return bool(
            self.s3_sources
            or self.s3_targets
            or self.catalog_sources
            or self.catalog_targets
            or self.jdbc_sources
            or self.jdbc_targets
            or self.snowflake_sources
            or self.snowflake_targets
        )


def parse_glue_script(source_code: str) -> ScriptLineageResult:
    result = ScriptLineageResult()
    if not source_code:
        return result

    _parse_glue_context_sources(source_code, result)
    _parse_glue_context_targets(source_code, result)
    _parse_spark_read(source_code, result)
    _parse_spark_write(source_code, result)
    _parse_spark_snowflake(source_code, result)

    logger.debug(
        "Script lineage result: s3_sources=%s, s3_targets=%s, catalog_sources=%d, catalog_targets=%d, "
        "jdbc_sources=%d, jdbc_targets=%d, snowflake_sources=%d, snowflake_targets=%d",
        result.s3_sources,
        result.s3_targets,
        len(result.catalog_sources),
        len(result.catalog_targets),
        len(result.jdbc_sources),
        len(result.jdbc_targets),
        len(result.snowflake_sources),
        len(result.snowflake_targets),
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
            elif _is_snowflake(conn_type):
                ref = _snowflake_ref(block, source_code)
                if ref:
                    result.snowflake_sources.append(ref)
                    logger.debug("Found Snowflake source: %s", ref)
            elif conn_type and conn_type.lower() in (
                "jdbc",
                "mysql",
                "postgresql",
                "oracle",
                "redshift",
            ):
                table = _extract_dict_value(block, "dbtable") or _extract_dict_value(block, "dynamodb.input.tableName")
                connection_name = _extract_kwarg(block, "catalog_connection") or _extract_kwarg(
                    block, "connection_name"
                )
                if table:
                    result.jdbc_sources.append(JDBCRef(connection_name=connection_name, table=table))
        except Exception as exc:
            logger.debug(f"Failed to parse from_options block: {exc}")


def _parse_glue_context_targets(source_code: str, result: ScriptLineageResult):  # noqa: C901
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
                logger.debug(f"Found JDBC target: connection={connection_name}, database={database}, table={table}")
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
            elif _is_snowflake(conn_type):
                ref = _snowflake_ref(block, source_code)
                if ref:
                    result.snowflake_targets.append(ref)
                    logger.debug("Found Snowflake target: %s", ref)
            elif conn_type:
                table = _extract_dict_value(block, "dbtable")
                connection_name = _extract_kwarg(block, "catalog_connection")
                if table:
                    result.jdbc_targets.append(JDBCRef(connection_name=connection_name, table=table))
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
        if path.startswith(("s3://", "s3a://", "s3n://")):  # noqa: SIM102
            if path not in result.s3_sources:
                result.s3_sources.append(path)
                logger.debug(f"Found Spark read S3 source: {path}")

    for match in SPARK_READ_FORMAT_LOAD_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):  # noqa: SIM102
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
        if path.startswith(("s3://", "s3a://", "s3n://")):  # noqa: SIM102
            if path not in result.s3_targets:
                result.s3_targets.append(path)
                logger.debug(f"Found Spark write S3 target: {path}")

    for match in SPARK_WRITE_FORMAT_SAVE_PATTERN.finditer(source_code):
        path = match.group(1)
        if path.startswith(("s3://", "s3a://", "s3n://")):  # noqa: SIM102
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
                result.catalog_targets.append(CatalogRef(database=parts[0], table=parts[1]))
            else:
                result.catalog_targets.append(CatalogRef(database="default", table=table_ref))
            logger.debug(f"Found Spark saveAsTable/insertInto target: {table_ref}")


def _unique_script_option(pattern: re.Pattern, source_code: str) -> str | None:
    """
    Script-wide fallback for sfDatabase / sfSchema (the shared options dict).
    Only trusted when the script defines exactly one distinct value: with
    several candidates the first match could belong to another block, so the
    value is left unset and the resolver falls back to a less specific lookup.
    """
    values = {match.group(1) for match in pattern.finditer(source_code)}
    return values.pop() if len(values) == 1 else None


def _shared_options_dict(name: str, source_code: str) -> str:
    """
    Body of the dict literal assigned to `name`, the dict a block passes as
    .options(**name) / connection_options=name. Empty when there is none, or when
    the name is assigned more than once: the block cannot tell which dict applies,
    and taking the first one could link a write to the table the script read.
    """
    literals = re.findall(rf"^\s*{name}\s*=\s*\{{([^{{}}]*)\}}", source_code, re.MULTILINE | re.DOTALL)
    return literals[0] if len(literals) == 1 else ""


def _ordered_options(block: str, source_code: str, expand_shared: bool = True) -> dict[str, str]:
    """
    Options the block sets, applied in call order so the last setting wins, as
    in Spark: .option("sfSchema", "RAW").options(**target) takes target's sfSchema.
    A shared dict is expanded where it is passed. Keys are lower-cased because
    Spark options are case-insensitive.
    """
    options: dict[str, str] = {}
    for match in OPTION_SETTER_PATTERN.finditer(block):
        shared_name = match.group("shared_name")
        if shared_name and expand_shared:
            shared = _shared_options_dict(shared_name, source_code)
            options.update(_ordered_options(shared, source_code, expand_shared=False))
        elif not shared_name:
            # pick the value by the form that matched: an empty value is falsy;
            # a bare string literal is no setting
            form = next((form for form in ("option", "entry", "kwarg") if match.group(f"{form}_key")), None)
            if form:
                options[match.group(f"{form}_key").lower()] = match.group(f"{form}_value")
    return options


def _split_qualified_name(name: str) -> list[str]:
    return [part.strip('"') for part in QUALIFIED_NAME_PART_PATTERN.findall(name)]


def _snowflake_ref(block: str, source_code: str) -> SnowflakeRef | None:
    """
    `dbtable` may be qualified (DB.SCHEMA.TABLE or SCHEMA.TABLE); otherwise
    sfDatabase / sfSchema are the last values the block sets, inline or through
    the shared options dict it passes, then the script's when it defines a single value.
    """
    options = _ordered_options(block, source_code)
    table = options.get("dbtable")
    if not table:
        return None
    database = options.get("sfdatabase") or _unique_script_option(SNOWFLAKE_DATABASE_PATTERN, source_code)
    schema = options.get("sfschema") or _unique_script_option(SNOWFLAKE_SCHEMA_PATTERN, source_code)

    parts = _split_qualified_name(table)
    if len(parts) == 3:
        database, schema, table = parts
    elif len(parts) == 2:
        schema, table = parts
    else:
        table = parts[0] if parts else table
    return SnowflakeRef(table=table, database=database, schema=schema)


def _resolve_spark_format(literal: str | None, name: str | None, source_code: str) -> str | None:
    """The format string, looking up `name = "..."` in the script when format() was given a name."""
    if literal:
        return literal
    match = re.search(rf"^\s*{name}\s*=\s*[\"']([^\"']+)[\"']", source_code, re.MULTILINE)
    return match.group(1) if match else None


def _is_snowflake_format(match: re.Match, source_code: str) -> bool:
    spark_format = _resolve_spark_format(match.group(2), match.group(3), source_code)
    return bool(spark_format) and spark_format.lower() in SNOWFLAKE_FORMATS


def _spark_snowflake_ref(match: re.Match, source_code: str) -> SnowflakeRef | None:
    if not _is_snowflake_format(match, source_code):
        return None
    return _snowflake_ref(match.group(1) + match.group(4), source_code)


def _parse_spark_snowflake(source_code: str, result: ScriptLineageResult):
    source_code = LINE_CONTINUATION_PATTERN.sub(" ", source_code)
    for match in SPARK_READ_SNOWFLAKE_PATTERN.finditer(source_code):
        ref = _spark_snowflake_ref(match, source_code)
        if ref:
            result.snowflake_sources.append(ref)
            logger.debug("Found Spark read.format('snowflake') source: %s", ref)

    for match in SPARK_WRITE_SNOWFLAKE_PATTERN.finditer(source_code):
        ref = _spark_snowflake_ref(match, source_code)
        if ref:
            result.snowflake_targets.append(ref)
            logger.debug("Found Spark write.format('snowflake') target: %s", ref)
