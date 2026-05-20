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
Custom wrapper for Lineage Request
"""

from typing import Optional, Type, TypeVar  # noqa: UP035

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest

T = TypeVar("T", bound=BaseModel)


class OMetaLineageRequest(BaseModel):
    override_lineage: Optional[bool] = False  # noqa: UP045
    lineage_request: AddLineageRequest
    entity_fqn: Optional[str] = None  # noqa: UP045
    entity: Optional[Type[T]] = None  # noqa: UP006, UP045
