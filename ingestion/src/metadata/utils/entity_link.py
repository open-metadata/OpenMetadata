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
from typing import List, TypeVar

from antlr4.CommonTokenStream import CommonTokenStream
from antlr4.error.ErrorStrategy import BailErrorStrategy
from antlr4.InputStream import InputStream
from antlr4.tree.Tree import ParseTreeWalker
from pydantic import BaseModel

from metadata.antlr.split_listener import SplitListener
from metadata.generated.antlr.EntityLinkLexer import EntityLinkLexer
from metadata.generated.antlr.EntityLinkParser import EntityLinkParser
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.dispatch import class_register
from metadata.utils.elasticsearch import get_entity_from_es_result

T = TypeVar("T", bound=BaseModel)

ENTITY_SEPARATOR: str = "::"
entity_link_build_registry = class_register()


class EntityLinkBuildingException(Exception):
    """
    Raise for inconsistencies when building the EntityLink
    """


def split(s: str) -> List[str]:
    lexer = EntityLinkLexer(InputStream(s))
    stream = CommonTokenStream(lexer)
    parser = EntityLinkParser(stream)
    parser._errHandler = BailErrorStrategy()
    tree = parser.entitylink()
    walker = ParseTreeWalker()
    splitter = SplitListener()
    walker.walk(splitter, tree)
    return splitter.split()
