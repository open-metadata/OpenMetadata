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

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

logger: logging.Logger = logging.getLogger(__name__)

# Allow types from the generated pydantic models
Entity = TypeVar("Entity", bound=BaseModel)


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
        for filter_pattern in self.includes:
            if not self.alphabet_pattern.match(filter_pattern):
                return False
        return True

    def get_allowed_list(self):
        assert self.is_fully_specified_include_list()
        return [a for a in self.includes if self.included(a)]
