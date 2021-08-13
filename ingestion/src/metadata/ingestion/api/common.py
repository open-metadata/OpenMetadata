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
    config: Optional[Any]


class WorkflowExecutionError(Exception):
    """An error occurred when executing the workflow"""


class IncludeFilterPattern(ConfigModel):
    """A class to store allow deny regexes"""

    includes: List[str] = [".*"]
    excludes: List[str] = []
    alphabet: str = "[A-Za-z0-9 _.-]"

    @property
    def alphabet_pattern(self):
        return re.compile(f"^{self.alphabet}+$")

    @classmethod
    def allow_all(cls):
        return IncludeFilterPattern()

    def included(self, string: str) -> bool:
        try:
            for exclude in self.excludes:
                if re.match(exclude, string):
                    return False

            for include in self.includes:
                if re.match(include, string):
                    return True
            return False
        except Exception as err:
            raise Exception("Regex Error: {}".format(err))

    def is_fully_specified_include_list(self) -> bool:
        for include_pattern in self.includes:
            if not self.alphabet_pattern.match(include_pattern):
                return False
        return True

    def get_allowed_list(self):
        assert self.is_fully_specified_include_list()
        return [a for a in self.includes if self.included(a)]
