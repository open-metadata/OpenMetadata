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
import hashlib
import re
from typing import Dict, List, Optional, Type, TypeVar, Union

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream
from antlr4.tree.Tree import ParseTreeWalker
from pydantic import BaseModel, Field

from metadata.antlr.split_listener import FqnSplitListener
from metadata.generated.antlr.FqnLexer import FqnLexer
from metadata.generated.antlr.FqnParser import FqnParser
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.query import Query
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testSuite import TestSuite
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


class SplitTestCaseFqn(BaseModel):
    service: str
    database: str
    schema_: str = Field(alias="schema")
    table: str
    column: Optional[str] = None
    test_case: Optional[str] = None


def split(str_: str) -> List[str]:
    """
    Equivalent of Java's FullyQualifiedName#split
    """
    lexer = FqnLexer(InputStream(str_))
    stream = CommonTokenStream(lexer)
    parser = FqnParser(stream)
    parser._errHandler = BailErrorStrategy()  # pylint: disable=protected-access
    tree = parser.fqn()
    walker = ParseTreeWalker()
    splitter = FqnSplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def _build(*args, quote: bool = True) -> str:
    """
    Equivalent of Java's FullyQualifiedName#build
    """
    if quote:
        quoted = [quote_name(name) for name in args]
        return FQN_SEPARATOR.join(quoted)

    return FQN_SEPARATOR.join(args)


def unquote_name(name: str) -> str:
    return name[1:-1] if name and name[0] == '"' and name[-1] == '"' else name


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


def build(
    metadata: Optional[OpenMetadata], entity_type: Type[T], **kwargs
) -> Optional[str]:
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
    metadata: Optional[OpenMetadata],
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

    entity: Optional[Union[Table, List[Table]]] = None

    if not skip_es_search:
        entity = search_table_from_es(
            metadata=metadata,
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
            fetch_multiple_entities=fetch_multiple_entities,
            service_name=service_name,
        )

    # if entity not found in ES proceed to build FQN with database_name and schema_name
    if not entity and database_name and schema_name:
        fqn = _build(service_name, database_name, schema_name, table_name)
        return [fqn] if fetch_multiple_entities else fqn
    if entity and fetch_multiple_entities:
        return [str(table.fullyQualifiedName.root) for table in entity]
    if entity:
        return str(entity.fullyQualifiedName.root)
    return None


@fqn_build_registry.add(DatabaseSchema)
def _(
    metadata: Optional[OpenMetadata],  # ES Search not enabled for Schemas
    *,
    service_name: str,
    database_name: Optional[str],
    schema_name: str,
    skip_es_search: bool = True,
    fetch_multiple_entities: bool = False,
) -> Union[Optional[str], Optional[List[str]]]:
    entity: Optional[Union[DatabaseSchema, List[DatabaseSchema]]] = None

    if not skip_es_search:
        entity = search_database_schema_from_es(
            metadata=metadata,
            database_name=database_name,
            schema_name=schema_name,
            fetch_multiple_entities=fetch_multiple_entities,
            service_name=service_name,
        )

    if not entity and database_name:
        fqn = _build(service_name, database_name, schema_name)
        return [fqn] if fetch_multiple_entities else fqn
    if entity and fetch_multiple_entities:
        return [str(table.fullyQualifiedName.root) for table in entity]
    if entity:
        return str(entity.fullyQualifiedName.root)

    return None


@fqn_build_registry.add(Database)
def _(
    _: Optional[OpenMetadata],  # ES Search not enabled for Databases
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
    _: Optional[OpenMetadata],  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    dashboard_name: str,
) -> str:
    if not service_name or not dashboard_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, dashboard=`{dashboard_name}``"
        )
    return _build(service_name, dashboard_name)


@fqn_build_registry.add(APICollection)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    api_collection_name: str,
) -> str:
    if not service_name or not api_collection_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, collection=`{api_collection_name}``"
        )
    return _build(service_name, api_collection_name)


@fqn_build_registry.add(Chart)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for dashboard FQN building
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
    _: Optional[OpenMetadata],  # ES Index not necessary for MlModel FQN building
    *,
    service_name: str,
    mlmodel_name: str,
) -> str:
    if not service_name or not mlmodel_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, mlmodel=`{mlmodel_name}``"
        )
    return _build(service_name, mlmodel_name)


@fqn_build_registry.add(TestSuite)
def _(_: Optional[OpenMetadata], *, table_fqn: str) -> str:
    """
    We don't need to quote since this comes from a table FQN.
    We're replicating the backend logic of the FQN generation in the TestSuiteRepository
    for executable test suites.
    """
    return _build(table_fqn, "testSuite", quote=False)


@fqn_build_registry.add(Topic)
def _(
    metadata: Optional[OpenMetadata],
    *,
    service_name: str,
    topic_name: str,
    skip_es_search: bool = True,
) -> Optional[str]:
    entity: Optional[Topic] = None

    if not skip_es_search:
        entity = search_topic_from_es(
            metadata=metadata, service_name=service_name, topic_name=topic_name
        )

    # if entity not found in ES proceed to build FQN with database_name and schema_name
    if not entity and service_name and topic_name:
        fqn = _build(service_name, topic_name)
        return fqn

    if entity:
        return str(entity.fullyQualifiedName.root)

    if not all([service_name, topic_name]):
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, topic=`{topic_name}``"
        )

    return None


@fqn_build_registry.add(Container)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for Container FQN building
    *,
    service_name: str,
    parent_container: str,
    container_name: str,
) -> str:
    if not service_name or not container_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, container=`{container_name}``"
        )
    return (
        _build(parent_container, container_name, quote=False)
        if parent_container
        else (_build(service_name, container_name))
    )


@fqn_build_registry.add(SearchIndex)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for Search Index FQN building
    *,
    service_name: str,
    search_index_name: str,
) -> str:
    if not service_name or not search_index_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, search_index=`{search_index_name}``"
        )
    return _build(service_name, search_index_name)


@fqn_build_registry.add(Tag)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for Tag FQN building
    *,
    classification_name: str,
    tag_name: str,
) -> str:
    if not classification_name or not tag_name:
        raise FQNBuildingException(
            f"Args should be informed, but got category=`{classification_name}`, tag=`{tag_name}``"
        )
    return _build(classification_name, tag_name)


@fqn_build_registry.add(DataModel)
def _(
    _: Optional[OpenMetadata],
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    model_name: str,
) -> str:
    return _build(service_name, database_name, schema_name, model_name)


@fqn_build_registry.add(StoredProcedure)
def _(
    _: Optional[OpenMetadata],
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    procedure_name: str,
) -> str:
    return _build(service_name, database_name, schema_name, procedure_name)


@fqn_build_registry.add(Pipeline)
def _(
    _: Optional[OpenMetadata],
    *,
    service_name: str,
    pipeline_name: str,
) -> str:
    return _build(service_name, pipeline_name)


@fqn_build_registry.add(Column)
def _(
    _: Optional[OpenMetadata],  # ES Search not enabled for Columns
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
        return [str(user.fullyQualifiedName.root) for user in entity]
    return str(entity.fullyQualifiedName.root)


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
        return [str(user.fullyQualifiedName.root) for user in entity]
    return str(entity.fullyQualifiedName.root)


@fqn_build_registry.add(TestCase)
def _(
    _: Optional[OpenMetadata],  # ES Search not enabled for TestCase
    *,
    service_name: str,
    database_name: str,
    schema_name: str,
    table_name: str,
    column_name: Optional[str],
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


@fqn_build_registry.add(DashboardDataModel)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    data_model_name: str,
) -> str:
    if not service_name or not data_model_name:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, chart=`{data_model_name}``"
        )
    return _build(service_name, "model", data_model_name)


@fqn_build_registry.add(Query)
def _(
    _: Optional[OpenMetadata],  # ES Index not necessary for dashboard FQN building
    *,
    service_name: str,
    query_checksum: str,
) -> str:
    if not service_name or not query_checksum:
        raise FQNBuildingException(
            f"Args should be informed, but got service=`{service_name}`, query_checksum=`{query_checksum}``"
        )
    return _build(service_name, query_checksum)


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


def split_test_case_fqn(test_case_fqn: str) -> SplitTestCaseFqn:
    """given a test case fqn split each element

    Args:
        test_case_fqn (str): test case fqn

    Returns:
        Dict[str, Optional[str]]:
    """
    details = split(test_case_fqn)
    if len(details) < 5:
        raise ValueError(
            f"{test_case_fqn} does not appear to be a valid test_case fqn "
        )
    if len(details) != 6:
        details.insert(4, None)  # type: ignore

    (  # pylint: disable=unbalanced-tuple-unpacking
        service,
        database,
        schema,
        table,
        column,
        test_case,
    ) = details

    return SplitTestCaseFqn(
        service=service,
        database=database,
        schema=schema,
        table=table,
        column=column,
        test_case=test_case,
    )


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
    if not table_name:
        raise FQNBuildingException(
            f"Table Name should be informed, but got table=`{table_name}`"
        )
    fqn_search_string = _build(
        service_name or "*", database_name or "*", schema_name or "*", table_name
    )
    return fqn_search_string


def search_database_schema_from_es(
    metadata: OpenMetadata,
    database_name: str,
    schema_name: str,
    service_name: str,
    fetch_multiple_entities: bool = False,
    fields: Optional[str] = None,
):
    """
    Find database schema entity in elasticsearch index.

    :param metadata: OM Client
    :param database_name: name of database in which we are searching for database schema
    :param schema_name: name of schema we are searching for
    :param service_name: name of service in which we are searching for database schema
    :param fetch_multiple_entities: should single match be returned or all matches
    :param fields: additional fields to return
    :return: entity / entities matching search criteria
    """
    if not schema_name:
        raise FQNBuildingException(
            f"Schema Name should be informed, but got schema_name=`{schema_name}`"
        )

    fqn_search_string = _build(service_name or "*", database_name or "*", schema_name)

    es_result = metadata.es_search_from_fqn(
        entity_type=DatabaseSchema,
        fqn_search_string=fqn_search_string,
        fields=fields,
    )

    return get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )


def search_table_from_es(
    metadata: OpenMetadata,
    database_name: str,
    schema_name: str,
    service_name: str,
    table_name: str,
    fetch_multiple_entities: bool = False,
    fields: Optional[str] = None,
):
    fqn_search_string = build_es_fqn_search_string(
        database_name, schema_name, service_name, table_name
    )

    es_result = metadata.es_search_from_fqn(
        entity_type=Table,
        fqn_search_string=fqn_search_string,
        fields=fields,
    )

    return get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )


def search_database_from_es(
    metadata: OpenMetadata,
    database_name: str,
    service_name: Optional[str],
    fetch_multiple_entities: Optional[bool] = False,
    fields: Optional[str] = None,
):
    """
    Search Database entity from ES
    """

    if not database_name:
        raise FQNBuildingException(
            f"Database Name should be informed, but got database=`{database_name}`"
        )

    fqn_search_string = _build(service_name or "*", database_name)

    es_result = metadata.es_search_from_fqn(
        entity_type=Database,
        fqn_search_string=fqn_search_string,
        fields=fields,
    )

    return get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=fetch_multiple_entities
    )


def search_topic_from_es(
    metadata: OpenMetadata,
    topic_name: str,
    service_name: Optional[str],
    fields: Optional[str] = None,
):
    """
    Search Topic entity from ES
    """

    if not topic_name:
        raise FQNBuildingException(
            f"Topic Name should be informed, but got topic=`{topic_name}`"
        )

    fqn_search_string = _build(service_name or "*", topic_name)

    es_result = metadata.es_search_from_fqn(
        entity_type=Topic,
        fqn_search_string=fqn_search_string,
        fields=fields,
    )

    return get_entity_from_es_result(
        entity_list=es_result, fetch_multiple_entities=False
    )


def get_query_checksum(query: str) -> str:
    """
    Prepare the query checksum from its string representation.
    The checksum is used as the query's name.
    """
    return hashlib.md5(query.encode()).hexdigest()
