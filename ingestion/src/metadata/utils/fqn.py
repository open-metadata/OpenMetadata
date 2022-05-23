#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Handle FQN building and splitting logic.
Filter information has been taken from the
ES indexes definitions
"""
import re
from typing import List, Optional, Type, TypeVar

from antlr4 import *
from pydantic import BaseModel

from metadata.antlr.split_listener import SplitListener
from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.antlr.FqnLexer import FqnLexer
from metadata.generated.antlr.FqnParser import FqnParser
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import DataModel, Table
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.dispatch import class_register
from metadata.utils.elasticsearch import get_entity_from_es_result

T = TypeVar("T", bound=BaseModel)

fqdn_build_registry = class_register()


class FQNBuildingException(Exception):
    """
    Raise for inconsistencies when building the FQN
    """


def split(s: str) -> List[str]:
    """
    Equivalent of Java's FullyQualifiedName#split
    """
    lexer = FqnLexer(InputStream(s))
    stream = CommonTokenStream(lexer)
    parser = FqnParser(stream)
    parser._errHandler = BailErrorStrategy()
    tree = parser.fqn()
    walker = ParseTreeWalker()
    splitter = SplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def _build(*args) -> str:
    """
    Equivalent of Java's FullyQualifiedName#build
    """
    quoted = [quote_name(name) for name in args]
    return FQDN_SEPARATOR.join(quoted)


def quote_name(name: str) -> str:
    """
    Equivalent of Java's FullyQualifiedName#quoteName
    """
    matcher = re.compile(r'^(")([^"]+)(")$|^(.*)$').match(name)
    if not matcher or len(matcher.group(0)) != len(name):
        raise ValueError("Invalid name " + name)

    # Name matches quoted string "sss".
    # If quoted string does not contain "." return unquoted sss, else return quoted "sss"
    if matcher.group(1):
        unquoted_name = matcher.group(2)
        return name if "." in unquoted_name else unquoted_name

    # Name matches unquoted string sss
    # If unquoted string contains ".", return quoted "sss", else unquoted sss
    unquoted_name = matcher.group(4)
    if '"' not in unquoted_name:
        return '"' + name + '"' if "." in unquoted_name else unquoted_name
    raise ValueError("Invalid name " + name)


def build(metadata: OpenMetadata, entity_type: Type[T], **kwargs) -> Optional[str]:
    """
    Given an Entity T, build the FQN of that Entity
    based on its required pieces. For example,
    to build a Table FQN we need:
        - service
        - database
        - schema
        - and table names.

    :param metadata: OpenMetadata Client
    :param entity_type: Pydantic Entity model
    :param kwargs: required to build the FQN
    :return: FQN as a string
    """
    fn = fqdn_build_registry.registry.get(entity_type.__name__)
    if not fn:
        raise FQNBuildingException(
            f"Invalid Entity Type {entity_type.__name__}. FQN builder not implemented."
        )
    return fn(metadata, **kwargs)


@fqdn_build_registry.add(Table)
def _(
    metadata: OpenMetadata,
    *,
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    table_name: str,
) -> Optional[str]:
    """
    Building logic for tables
    :param metadata: OMeta client
    :param service_name: Service Name to filter
    :param database_name: DB name or None
    :param schema_name: Schema name or None
    :param table_name: Table name
    :return:
    """
    if not service_name or not table_name:
        raise FQNBuildingException(
            f"Service Name and Table Name should be informed, but got service=`{service_name}`, table=`{table_name}`"
        )

    if not database_name or not schema_name:
        es_result = metadata.es_search_from_service(
            entity_type=Table,
            service_name=service_name,
            filters={
                "database": database_name,
                "database_schema": schema_name,
                "name": table_name,
            },
        )
        entity: Optional[Table] = get_entity_from_es_result(entity_list=es_result)
        return str(entity.fullyQualifiedName.__root__) if entity else None

    return _build(service_name, database_name, schema_name, table_name)


@fqdn_build_registry.add(DatabaseSchema)
def _(
    _: OpenMetadata,  # ES Search not enabled for Schemas
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
) -> str:
    if not service_name or not database_name or not schema_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, db=`{database_name}`, schema=`{schema_name}`"
        )
    return _build(service_name, database_name, schema_name)


@fqdn_build_registry.add(Database)
def _(
    _: OpenMetadata,  # ES Search not enabled for Databases
    *,
    service_name: str,
    database_name: str,
) -> str:
    if not service_name or not database_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, db=`{database_name}``"
        )
    return _build(service_name, database_name)


@fqdn_build_registry.add(Dashboard)
def _(
    _: OpenMetadata,  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    dashboard_name: str,
) -> str:
    if not service_name or not dashboard_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, dashboard=`{dashboard_name}``"
        )
    return _build(service_name, dashboard_name)


@fqdn_build_registry.add(Tag)
def _(
    _: OpenMetadata,  # ES Index not necessary for Tag FQN building
    *,
    tag_category_name: str,
    tag_name: str,
) -> str:
    if not tag_category_name or not tag_name:
        raise FQNBuildingException(
            f"Args should be informed, but got category=`{tag_category_name}`, tag=`{tag_name}``"
        )
    return _build(tag_category_name, tag_name)


@fqdn_build_registry.add(DataModel)
def _(
    metadata: OpenMetadata,
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    model_name: str,
) -> str:

    return _build(service_name, database_name, schema_name, model_name)
