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

"""Profiler utils class and functions"""

import re
from collections import defaultdict
from datetime import datetime
from functools import reduce
from typing import Optional, Tuple

import sqlparse
from pydantic import BaseModel

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import profiler_logger
from metadata.utils.lru_cache import SkipNoneLRUCache

logger = profiler_logger()
database_entities_cache = SkipNoneLRUCache(capacity=4096)

PARSING_TIMEOUT = 10


class QueryResult(BaseModel):
    """System metric query result shared by Redshift and Snowflake"""

    database_name: str
    schema_name: str
    table_name: str
    query_type: str
    start_time: datetime
    query_id: Optional[str] = None
    query_text: Optional[str] = None
    rows: Optional[int] = None


def clean_up_query(query: str) -> str:
    """remove comments and newlines from query"""
    return sqlparse.format(query, strip_comments=True).replace("\\n", "")


def get_identifiers_from_string(
    identifier: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """given a string identifier try to fetch the database, schema and table names.
    part of the identifier name as `"DATABASE.DOT"` will be returned on the left side of the tuple
    and the rest of the identifier name as `"SCHEMA.DOT.TABLE"` will be returned on the right side of the tuple

    Args:
        identifier (str): table identifier

    Returns:
        Tuple[str, str, str]: database, schema and table names
    """
    pattern = r"\"([^\"]+)\"|(\w+(?:\.\w+)*(?:\.\w+)*)"
    matches = re.findall(pattern, identifier)

    values = []
    for match in matches:
        if match[0] != "":
            values.append(match[0])
        if match[1] != "":
            split_match = match[1].split(".")
            values.extend(split_match)

    database_name, schema_name, table_name = ([None] * (3 - len(values))) + values
    return database_name, schema_name, table_name


def get_value_from_cache(cache: dict, key: str):
    """given a dict of cache and a key, return the value if exists

    Args:
        cache (dict): dict of cache
        key (str): key to look for in the cache
    """
    try:
        return reduce(dict.get, key.split("."), cache)
    except TypeError:
        return None


def set_cache(cache: defaultdict, key: str, value):
    """given a dict of cache, a key and a value, set the value in the cache

    Args:
        cache (dict): dict of cache
        key (str): key to set for in the cache
        value: value to set in the cache
    """
    split_key = key.split(".")
    for indx, key_ in enumerate(split_key):
        if indx == len(split_key) - 1:
            cache[key_] = value
            break
        cache = cache[key_]


@database_entities_cache.wrap(lambda id_, metadata: f"DatabaseSchema(id={id_.root!r})")
def _get_schema_cached(
    entity_id: Uuid, metadata: OpenMetadata
) -> Optional[DatabaseSchema]:
    """Cache schema lookups by id"""
    return metadata.get_by_id(
        entity=DatabaseSchema,
        entity_id=entity_id,
        fields=["databaseSchemaProfilerConfig"],
    )


@database_entities_cache.wrap(lambda id_, metadata: f"Database(id={id_.root!r})")
def _get_database_cached(entity_id: Uuid, metadata: OpenMetadata) -> Optional[Database]:
    """Cache database lookups by id"""
    return metadata.get_by_id(
        entity=Database,
        entity_id=entity_id,
        fields=["databaseProfilerConfig"],
    )


@database_entities_cache.wrap(lambda id_, metadata: f"DatabaseService(id={id_.root!r})")
def _get_service_cached(
    entity_id: Uuid, metadata: OpenMetadata
) -> Optional[DatabaseService]:
    """Cache database service lookups by id"""
    return metadata.get_by_id(
        entity=DatabaseService,
        entity_id=entity_id,
    )


def get_context_entities(
    entity: Table, metadata: OpenMetadata
) -> Tuple[Optional[DatabaseSchema], Optional[Database], Optional[DatabaseService]]:
    """Based on the table, get all the parent entities"""
    schema_entity = None
    database_entity = None
    db_service = None

    if entity.databaseSchema:
        schema_entity = _get_schema_cached(entity.databaseSchema.id, metadata)

    if entity.database:
        database_entity = _get_database_cached(entity.database.id, metadata)

    if entity.service:
        db_service = _get_service_cached(entity.service.id, metadata)

    return schema_entity, database_entity, db_service
