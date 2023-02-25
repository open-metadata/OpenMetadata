#  Copyright 2022 Collate
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
Utility functions to create open metadata connections from yaml file
"""

import os
import traceback
from typing import Any, Optional

import yaml
from jinja2 import Environment, FileSystemLoader, TemplateNotFound, select_autoescape

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.utils.logger import great_expectations_logger

logger = great_expectations_logger()


def env(key: str) -> Optional[Any]:
    """Render environment variable from jinja template

    Args:
        key: environment variable key

    Returns:
        Any
    """
    return os.getenv(key)


def create_jinja_environment(template_path: str) -> Environment:
    """Create jinja environment and register environment variable reading function

    Args:
        template_path: path to the folder holding the template
    """

    environment = Environment(
        loader=FileSystemLoader(template_path), autoescape=select_autoescape()
    )
    environment.globals["env"] = env

    return environment


def render_template(environment: Environment, template_file: str = "config.yml") -> str:
    """Render tenmplate file

    Args:
        template_file: name of the template file

    Returns:
        str
    """
    file_type = os.path.splitext(template_file)
    if file_type[1] not in {".yaml", ".yml"}:
        raise TypeError(
            f"Unsupported file type: {file_type}. Type should be `.yaml` or `.yml`"
        )

    try:
        tmplt = environment.get_template(template_file)
        return tmplt.render()
    except TemplateNotFound as err:
        logger.debug(traceback.format_exc())
        logger.warning(f"Template file at {template_file} not found: {err}")
        try:
            tmplt = environment.get_template("config.yaml")
            return tmplt.render()
        except TemplateNotFound as exc:
            raise TemplateNotFound(
                f"Config file at {environment.loader.searchpath} not found"
            ) from exc


def create_ometa_connection_obj(config: str) -> OpenMetadataConnection:
    """Create OpenMetadata connection"""
    return OpenMetadataConnection.parse_obj(yaml.safe_load(config))
