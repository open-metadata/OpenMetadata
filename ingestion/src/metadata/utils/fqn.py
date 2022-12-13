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
from collections import namedtuple
from typing import Dict, List, Optional, Type, TypeVar, Union

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream
from antlr4.tree.Tree import ParseTreeWalker
from pydantic import BaseModel

from metadata.antlr.split_listener import FqnSplitListener
from metadata.generated.antlr.FqnLexer import FqnLexer
from metadata.generated.antlr.FqnParser import FqnParser
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.dispatch import class_register
from metadata.utils.elasticsearch import get_entity_from_es_result

T = TypeVar("T", bound=BaseModel)

FQN_SEPARATOR: str = "."
fqn_build_registry = class_register()


class FQNBuildingException(Exception):
    """
    Raise for inconsistencies when building the FQN
    """


def split(s: str) -> List[str]:  # pylint: disable=invalid-name
    """
    Equivalent of Java's FullyQualifiedName#split
    """
    lexer = FqnLexer(InputStream(s))
    stream = CommonTokenStream(lexer)
    parser = FqnParser(stream)
    parser._errHandler = BailErrorStrategy()  # pylint: disable=protected-access
    tree = parser.fqn()
    walker = ParseTreeWalker()
    splitter = FqnSplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def _build(*args) -> str:
    """
    Equivalent of Java's FullyQualifiedName#build
    """
    quoted = [quote_name(name) for name in args]
    return FQN_SEPARATOR.join(quoted)


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
    func = fqn_build_registry.registry.get(entity_type.__name__)
    if not func:
        raise FQNBuildingException(
            f"Invalid Entity Type {entity_type.__name__}. FQN builder not implemented."
        )
    return func(metadata, **kwargs)


@fqn_build_registry.add(Table)
def _(
    metadata: OpenMetadata,
    *,
    service_name: str,
    database_name: Optional[str],
    schema_name: Optional[str],
    table_name: str,
    fetch_multiple_entities: bool = False,
    skip_es_search: bool = False,
) -> Union[Optional[str], Optional[List[str]]]:
    """
    Building logic for tables
    :param metadata: OMeta client
    :param service_name: Service Name to filter
    :param database_name: DB name or None
    :param schema_name: Schema name or None
    :param table_name: Table name
    :return:
    """
    fqn_search_string = build_es_fqn_search_string(
        database_name, schema_name, service_name, table_name
    )

    es_result = (
        metadata.es_search_from_fqn(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
        )
        if not skip_es_search
        else None
    )

    entity: Optional[Union[Table, List[Table]]] = get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )
    # if entity not found in ES proceed to build FQN with database_name and schema_name
    if not entity and database_name and schema_name:
        fqn = _build(service_name, database_name, schema_name, table_name)
        return [fqn] if fetch_multiple_entities else fqn
    if entity and fetch_multiple_entities:
        return [str(table.fullyQualifiedName.__root__) for table in entity]
    if entity:
        return str(entity.fullyQualifiedName.__root__)
    return None


@fqn_build_registry.add(DatabaseSchema)
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


@fqn_build_registry.add(Database)
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


@fqn_build_registry.add(Dashboard)
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


@fqn_build_registry.add(Chart)
def _(
    _: OpenMetadata,  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    chart_name: str,
) -> str:
    if not service_name or not chart_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, chart=`{chart_name}``"
        )
    return _build(service_name, chart_name)


@fqn_build_registry.add(MlModel)
def _(
    _: OpenMetadata,  # ES Index not necessary for MlModel FQN building
    *,
    service_name: str,
    mlmodel_name: str,
) -> str:
    if not service_name or not mlmodel_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, mlmodel=`{mlmodel_name}``"
        )
    return _build(service_name, mlmodel_name)


@fqn_build_registry.add(Topic)
def _(
    _: OpenMetadata,  # ES Index not necessary for Topic FQN building
    *,
    service_name: str,
    topic_name: str,
) -> str:
    if not service_name or not topic_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, topic=`{topic_name}``"
        )
    return _build(service_name, topic_name)


@fqn_build_registry.add(Tag)
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


@fqn_build_registry.add(DataModel)
def _(
    _: OpenMetadata,
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    model_name: str,
) -> str:

    return _build(service_name, database_name, schema_name, model_name)


@fqn_build_registry.add(Pipeline)
def _(
    _: OpenMetadata,
    *,
    service_name: str,
    pipeline_name: str,
) -> str:
    return _build(service_name, pipeline_name)


@fqn_build_registry.add(Location)
def _(
    _: OpenMetadata,
    *,
    service_name: str,
    location_name: str,
) -> str:
    return _build(service_name, location_name)


@fqn_build_registry.add(Column)
def _(
    _: OpenMetadata,  # ES Search not enabled for Columns
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    table_name: str,
    column_name: str,
) -> str:
    return _build(service_name, database_name, schema_name, table_name, column_name)


@fqn_build_registry.add(User)
def _(
    metadata: OpenMetadata,
    *,
    user_name: str,
    fetch_multiple_entities: bool = False,
) -> Union[Optional[str], Optional[List[str]]]:
    """
    Building logic for User
    :param metadata: OMeta client
    :param user_name: User name
    :return:
    """

    fqn_search_string = _build(user_name)

    es_result = metadata.es_search_from_fqn(
        entity_type=User,
        fqn_search_string=fqn_search_string,
    )
    entity: Optional[Union[User, List[User]]] = get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )
    if not entity:
        return None
    if fetch_multiple_entities:
        return [str(user.fullyQualifiedName.__root__) for user in entity]
    return str(entity.fullyQualifiedName.__root__)


@fqn_build_registry.add(Team)
def _(
    metadata: OpenMetadata,
    *,
    team_name: str,
    fetch_multiple_entities: bool = False,
) -> Union[Optional[str], Optional[List[str]]]:
    """
    Building logic for Team
    :param metadata: OMeta client
    :param team_name: Team name
    :return:
    """

    fqn_search_string = _build(team_name)

    es_result = metadata.es_search_from_fqn(
        entity_type=Team,
        fqn_search_string=fqn_search_string,
    )
    entity: Optional[Union[Team, List[Team]]] = get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )
    if not entity:
        return None
    if fetch_multiple_entities:
        return [str(user.fullyQualifiedName.__root__) for user in entity]
    return str(entity.fullyQualifiedName.__root__)


@fqn_build_registry.add(TestCase)
def _(
    _: OpenMetadata,  # ES Search not enabled for TestCase
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    table_name: str,
    column_name: str,
    test_case_name: str,
) -> str:
    if column_name:
        return _build(
            service_name,
            database_name,
            schema_name,
            table_name,
            column_name,
            test_case_name,
        )
    return _build(
        service_name,
        database_name,
        schema_name,
        table_name,
        test_case_name,
    )


def split_table_name(table_name: str) -> Dict[str, Optional[str]]:
    """
    Given a table name, try to extract database, schema and
    table info
    :param table_name: raw table name
    :return: dict with data
    """
    # Revisit: Check the antlr grammer for issue when string has double quotes
    # Issue Link: https://github.com/open-metadata/OpenMetadata/issues/8874
    details: List[str] = split(table_name.replace('"', ""))
    # Pad None to the left until size of list is 3
    full_details: List[Optional[str]] = ([None] * (3 - len(details))) + details

    database, database_schema, table = full_details
    return {"database": database, "database_schema": database_schema, "table": table}


def split_test_case_fqn(test_case_fqn: str) -> Dict[str, Optional[str]]:
    """given a test case fqn split each element

    Args:
        test_case_fqn (str): test case fqn

    Returns:
        Dict[str, Optional[str]]:
    """
    SplitTestCaseFqn = namedtuple(
        "SplitTestCaseFqn", "service database schema table column test_case"
    )
    details = split(test_case_fqn)
    if len(details) < 5:
        raise ValueError(
            f"{test_case_fqn} does not appear to be a valid test_case fqn "
        )
    if len(details) != 6:
        details.insert(4, None)

    (  # pylint: disable=unbalanced-tuple-unpacking
        service,
        database,
        schema,
        table,
        column,
        test_case,
    ) = details

    return SplitTestCaseFqn(service, database, schema, table, column, test_case)


def build_es_fqn_search_string(
    database_name: str, schema_name, service_name, table_name
) -> str:
    """
    Builds FQN search string for ElasticSearch

    Args:
        service_name: service name to filter
        database_name: DB name or None
        schema_name: schema name or None
        table_name: table name

    Returns:
        FQN search string
    """
    if not service_name or not table_name:
        raise FQNBuildingException(
            f"Service Name and Table Name should be informed, but got service=`{service_name}`, table=`{table_name}`"
        )
    fqn_search_string = _build(
        service_name, database_name or "*", schema_name or "*", table_name
    )
    return fqn_search_string
