#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import re
from abc import ABCMeta, abstractmethod, ABC
from dataclasses import dataclass
from typing import Generic, TypeVar, Dict, Any, Optional, List, IO
from pydantic import BaseModel
import logging

T = TypeVar("T")

logger: logging.Logger = logging.getLogger(__name__)


@dataclass
class Record(Generic[T]):
    metadata: Dict[str, Any]


@dataclass
class WorkflowContext:
    workflow_id: str


class ConfigModel(BaseModel):
    class Config:
        extra = "forbid"


class DynamicTypedConfig(ConfigModel):
    type: str
    # This config type is declared Optional[Any] here. The eventual parser for the
    # specified type is responsible for further validation.
    config: Optional[Any]


class MetaError(Exception):
    """A base class for all meta exceptions"""


class WorkflowExecutionError(MetaError):
    """An error occurred when executing the workflow"""


class OperationalError(WorkflowExecutionError):
    """An error occurred because of client-provided metadata"""

    message: str
    info: dict

    def __init__(self, message: str, info: dict = None):
        self.message = message
        if info:
            self.info = info
        else:
            self.info = {}


class ConfigurationError(MetaError):
    """A configuration error has happened"""


class ConfigurationMechanism(ABC):
    @abstractmethod
    def load_config(self, config_fp: IO) -> dict:
        pass


class IncludeFilterPattern(ConfigModel):
    """A class to store allow deny regexes"""

    include: List[str] = [".*"]
    filter: List[str] = []
    alphabet: str = "[A-Za-z0-9 _.-]"

    @property
    def alphabet_pattern(self):
        return re.compile(f"^{self.alphabet}+$")

    @classmethod
    def allow_all(cls):
        return IncludeFilterPattern()

    def included(self, string: str) -> bool:
        try:
            for filter in self.filter:
                if re.match(filter, string):
                    return False

            for include in self.include:
                if re.match(include, string):
                    return True
            return False
        except Exception as err:
            raise Exception("Regex Error: {}".format(err))

    def is_fully_specified_include_list(self) -> bool:
        """
        If the allow patterns are literals and not full regexes, then it is considered
        fully specified. This is useful if you want to convert a 'list + filter'
        pattern into a 'search for the ones that are allowed' pattern, which can be
        much more efficient in some cases.
        """
        for include_pattern in self.include:
            if not self.alphabet_pattern.match(include_pattern):
                return False
        return True

    def get_allowed_list(self):
        assert self.is_fully_specified_include_list()
        return [a for a in self.include if self.included(a)]
