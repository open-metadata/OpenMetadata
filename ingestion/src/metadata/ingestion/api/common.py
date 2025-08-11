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
Common definitions for configuration management
"""
from typing import Any, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

from metadata.utils.logger import ingestion_logger

T = TypeVar("T")

logger = ingestion_logger()

# Allow types from the generated pydantic models
# TODO: deprecate me. This is never really used a TypeVar.
Entity = TypeVar("Entity", bound=BaseModel)


class ConfigModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DynamicTypedConfig(ConfigModel):
    type: str
    config: Optional[Any] = None


class WorkflowExecutionError(Exception):
    """An error occurred when executing the workflow"""
