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
from abc import ABC, abstractmethod
from typing import IO, Any, List, Optional
from pydantic import BaseModel


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


class AllowDenyPattern(ConfigModel):
    """ A class to store allow deny regexes"""

    allow: List[str] = [".*"]
    deny: List[str] = []

    @classmethod
    def allow_all(cls):
        return AllowDenyPattern()

    def allowed(self, string: str) -> bool:
        for deny_pattern in self.deny:
            if re.match(deny_pattern, string):
                return False

        for allow_pattern in self.allow:
            if re.match(allow_pattern, string):
                return True

        return False
