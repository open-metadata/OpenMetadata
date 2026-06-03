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
Pydantic definition for deleting entites
"""

from typing import Optional

from pydantic import BaseModel

from metadata.ingestion.api.models import Entity


class DeleteEntity(BaseModel):
    """Entity reference for a deletion candidate emitted by the ingestion flow.

    ``dispatch_async`` flips the sink to the server-side async delete endpoint
    (``DELETE /<entity>/async/{id}``) instead of the synchronous one, so ingestion
    isn't blocked on the cascade for large hierarchies (issue #4003).
    """

    entity: Entity
    mark_deleted_entities: Optional[bool] = False  # noqa: UP045
    dispatch_async: Optional[bool] = False  # noqa: UP045
