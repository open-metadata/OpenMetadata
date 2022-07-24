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
Define custom types as wrappers on top of
existing SQA types to have a bridge between
SQA dialects and OM rich type system
"""
from sqlalchemy import types


class SQAMap(types.String):
    """
    Custom Map type definition
    """


class SQAStruct(types.String):
    """
    Custom Struct type definition
    """


class SQAUnion(types.String):
    """
    Custom Struct type definition
    """


class SQASet(types.ARRAY):
    """
    Custom Set type definition
    """


class SQASGeography(types.String):
    """
    Custom Geography type definition
    """
