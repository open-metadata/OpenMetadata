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
Utility functions to cerate open metadata connections from yaml file
"""

import os
import yaml
from typing import Any, Optional

from jinja2 import Environment, FileSystemLoader, TemplateNotFound

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection
)


def env(key: str) -> Optional[Any]:
    """Render environment variable from jinja template
    
    Args:
        key: environment variable key

    Returns:
        Any
    """
    return os.getenv(key)


def create_jinja_environment(template_path: str):
    """Create jinja environment and register environment variable reading function
    
    Args:
        template_path: path to the folder holding the template
    """

    environment = Environment(loader=FileSystemLoader(template_path))
    environment.globals["env"] = env

    return environment


def render_template(environment: Environment, template_file: str = "config.yml") -> str:
    """Render tenmplate file
    
    Args:
        template_file: name of the template file
    """
    file_type = os.path.splitext(template_file)
    if file_type[1] not in {".yaml", ".yml"}:
        raise TypeError(f"Unsupported file type: {file_type}. Type should be `.yaml` or `.yml`")
    
    try:
        return environment.get_template(template_file).render()
    except TemplateNotFound as err:
        raise TypeError() from err


def create_ometa_connection(config: str) -> OpenMetadataConnection:
    """Create OpenMetadata connection"""
    return OpenMetadataConnection.parse_obj(
        yaml.safe_load(config)
    )

