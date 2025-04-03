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
Helper that implements custom dispatcher logic
"""

from collections import namedtuple
from typing import Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def enum_register():
    """
    Helps us register custom function for enum values
    """
    registry = {}

    def add(name: str):
        def inner(fn):
            registry[name] = fn
            return fn

        return inner

    Register = namedtuple("Register", ["add", "registry"])
    return Register(add, registry)


def class_register():
    """
    Helps us register custom functions for classes based on their name
    """
    registry = {}

    def add(entity_type: Type[T]):
        def inner(fn):
            _name = entity_type.__name__
            registry[_name] = fn
            return fn

        return inner

    Register = namedtuple("Register", ["add", "registry"])
    return Register(add, registry)
