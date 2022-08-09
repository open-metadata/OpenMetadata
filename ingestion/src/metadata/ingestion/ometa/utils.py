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
Helper functions to handle OpenMetadata Entities' properties
"""

import logging
import re
import string
from functools import singledispatch
from typing import Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.type import basic

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name


def ometa_logger():
    return logging.getLogger("OMetaAPI")


def format_name(name: str) -> str:
    """
    Given a name, replace all special characters by `_`
    :param name: name to format
    :return: formatted string
    """
    subs = re.escape(string.punctuation + " ")
    return re.sub(r"[" + subs + "]", "_", name)


def get_entity_type(
    entity: Union[Type[T], str],
) -> str:
    """
    Given an Entity T, return its type.
    E.g., Table returns table, Dashboard returns dashboard...

    Also allow to be the identity if we just receive a string
    """
    if isinstance(entity, str):
        return entity

    class_name: str = entity.__name__.lower()

    if "service" in class_name:
        # Capitalize service, e.g., pipelineService
        return class_name.replace("service", "Service")

    return class_name


@singledispatch
def model_str(arg) -> str:
    """
    Default model stringifying method
    """
    return str(arg)


@model_str.register(basic.Uuid)
@model_str.register(basic.FullyQualifiedEntityName)
@model_str.register(basic.EntityName)
def _(arg) -> str:
    """
    Models with __root__
    """
    return str(arg.__root__)
