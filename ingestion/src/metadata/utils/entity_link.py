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
from typing import List, Optional

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream
from antlr4.tree.Tree import ParseTreeWalker
from requests.compat import unquote_plus

from metadata.antlr.split_listener import EntityLinkSplitListener
from metadata.generated.antlr.EntityLinkLexer import EntityLinkLexer
from metadata.generated.antlr.EntityLinkParser import EntityLinkParser


class EntityLinkBuildingException(Exception):
    """
    Raise for inconsistencies when building the EntityLink
    """


def split(s: str) -> List[str]:  # pylint: disable=invalid-name
    """
    Method to handle the splitting logic
    """

    lexer = EntityLinkLexer(InputStream(s))
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

    Args:
        entity_link: entity link
    """

    return unquote_plus(entity_link.split("::")[-1].replace(">", ""))


def get_table_fqn(entity_link: str) -> str:
    """From an entity link get the table fqn

    Args:
        entity_link: entity link
    """

    return entity_link.split("::")[2]


def get_entity_link(table_fqn: str, column_name: Optional[str]) -> str:
    """From table fqn and column name get the entity_link

    Args:
        table_fqn: table fqn
        column_name: Optional param to generate entity link with column name
    """

    if column_name:
        entity_link = f"<#E::table::" f"{table_fqn}" f"::columns::" f"{column_name}>"
    else:
        entity_link = f"<#E::table::" f"{table_fqn}>"
    return entity_link
