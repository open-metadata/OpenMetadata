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

import io
import json
import pathlib
import re
from abc import ABC, abstractmethod
from typing import IO, Any, Optional

import yaml
from expandvars import UnboundVariable, expandvars
from pydantic import BaseModel

FQDN_SEPARATOR: str = "."


class ConfigModel(BaseModel):
    class Config:
        extra = "forbid"


class DynamicTypedConfig(ConfigModel):
    type: str
    config: Optional[Any]


class WorkflowExecutionError(Exception):
    """An error occurred when executing the workflow"""


class ConfigurationError(Exception):
    """A configuration error has happened"""


class ConfigurationMechanism(ABC):
    @abstractmethod
    def load_config(self, config_fp: IO) -> dict:
        pass


class YamlConfigurationMechanism(ConfigurationMechanism):
    """load configuration from yaml files"""

    def load_config(self, config_fp: IO) -> dict:
        config = yaml.safe_load(config_fp)
        return config


class JsonConfigurationMechanism(ConfigurationMechanism):
    """load configuration from json files"""

    def load_config(self, config_fp: IO) -> dict:
        config = json.load(config_fp)
        return config


def resolve_element(element: str) -> str:
    if re.search("(\$\{).+(\})", element):  # noqa: W605
        return expandvars(element, nounset=True)
    elif element.startswith("$"):
        try:
            return expandvars(element, nounset=True)
        except UnboundVariable:
            return element
    else:
        return element


def resolve_list(ele_list: list) -> list:
    new_v = []
    for ele in ele_list:
        if isinstance(ele, str):
            new_v.append(resolve_element(ele))  # type:ignore
        elif isinstance(ele, list):
            new_v.append(resolve_list(ele))  # type:ignore
        elif isinstance(ele, dict):
            resolve_env_variables(ele)
            new_v.append(resolve_env_variables(ele))  # type:ignore
        else:
            new_v.append(ele)
    return new_v


def resolve_env_variables(config: dict) -> dict:
    for k, v in config.items():
        if isinstance(v, dict):
            resolve_env_variables(v)
        elif isinstance(v, list):
            config[k] = resolve_list(v)
        elif isinstance(v, str):
            config[k] = resolve_element(v)
    return config


def load_config_file(config_file: pathlib.Path) -> dict:
    if not config_file.is_file():
        raise ConfigurationError(f"Cannot open config file {config_file}")

    config_mech: ConfigurationMechanism
    if config_file.suffix in [".yaml", ".yml"]:
        config_mech = YamlConfigurationMechanism()
    elif config_file.suffix == ".toml":
        config_mech = JsonConfigurationMechanism()
    else:
        raise ConfigurationError(
            "Only .json and .yml are supported. Cannot process file type {}".format(
                config_file.suffix
            )
        )
    with config_file.open() as raw_config_file:
        raw_config = raw_config_file.read()

    config_fp = io.StringIO(raw_config)
    config = config_mech.load_config(config_fp)
    resolve_env_variables(config)
    return config
