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
Handle Entity Link building and splitting logic.
Filter information has been taken from the
ES indexes definitions
"""
from typing import Any, List, Optional, TypeVar

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream
from antlr4.tree.Tree import ParseTreeWalker
from requests.compat import unquote_plus

from metadata.antlr.split_listener import EntityLinkSplitListener
from metadata.generated.antlr.EntityLinkLexer import EntityLinkLexer
from metadata.generated.antlr.EntityLinkParser import EntityLinkParser
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.dispatch import class_register

T = TypeVar("T", bound=BaseModel)


class CustomColumnName(BaseModel):
    root: str


class EntityLinkBuildingException(Exception):
    """
    Raise for inconsistencies when building the EntityLink
    """


def split(str_: str) -> List[str]:
    """
    Method to handle the splitting logic
    """

    lexer = EntityLinkLexer(InputStream(str_))
    stream = CommonTokenStream(lexer)
    parser = EntityLinkParser(stream)
    parser._errHandler = BailErrorStrategy()  # pylint: disable=protected-access
    tree = parser.entitylink()
    walker = ParseTreeWalker()
    splitter = EntityLinkSplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def get_decoded_column(entity_link: str) -> str:
    """From an URL encoded entity link get the decoded column name

    Examples:
        >>> get_decoded_column("<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::first_name>")
        'first name'
        >>> get_decoded_column("<#E::table::rds.dev.dbt_jaffle.column_w_space::columns::随机的>")
        '随机的'
        >>> get_decoded_column("<#E::table::rds.dev.dbt_jaffle.table_w_space>")
        ''

    Args:
        entity_link: entity link
    """

    return CustomColumnName(
        root=unquote_plus(entity_link.split("::")[-1].replace(">", ""))
    ).root


def get_table_fqn(entity_link: str) -> str:
    """From an entity link get the table fqn

    Args:
        entity_link: entity link
    """

    return split(entity_link)[1]


def get_table_or_column_fqn(entity_link: str) -> str:
    """From an entity link get the column fqn

    Args:
        entity_link: entity link
    """
    split_entity_link = split(entity_link)
    if len(split_entity_link) == 2:
        return split_entity_link[1]
    if len(split_entity_link) == 4 and split_entity_link[2] == "columns":
        return f"{split_entity_link[1]}.{split_entity_link[3]}"

    raise ValueError(
        "Invalid entity link."
        " {split_entity_link} does not look like a table or a column entity link"
    )


get_entity_link_registry = class_register()


def get_entity_link(entity_type: Any, fqn: str, **kwargs) -> str:
    """From table fqn and column name get the entity_link

    Args:
        entity_type: Entity being built
        fqn: Entity fqn
    """

    func = get_entity_link_registry.registry.get(entity_type.__name__)
    if not func:
        return f"<#E::{ENTITY_REFERENCE_TYPE_MAP[entity_type.__name__]}::{fqn}>"

    return func(fqn, **kwargs)


@get_entity_link_registry.add(Table)
def _(fqn: str, column_name: Optional[str] = None) -> str:
    """From table fqn and column name get the entity_link"""

    if column_name:
        entity_link = f"<#E::{ENTITY_REFERENCE_TYPE_MAP[Table.__name__]}::{fqn}::columns::{column_name}>"
    else:
        entity_link = f"<#E::{ENTITY_REFERENCE_TYPE_MAP[Table.__name__]}::{fqn}>"
    return entity_link
