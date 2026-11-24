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
Pydantic models for the Salesforce Data 360 REST API responses.
"""

from pydantic import BaseModel, ConfigDict

from metadata.ingestion.source.database.data360.constant import (
    Constant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.exceptions import Data360ResponseError


class EndpointPaging(BaseModel):
    """Paging contract of a Data 360 ``ssot/*`` listing endpoint. They all agree on
    limit/offset/total-size semantics but not on the field names carrying them, and
    Calculated Insights additionally wrap the page in a ``collection`` envelope.
    """

    model_config = ConfigDict(frozen=True)

    items_field: str
    limit_param: str = Constant.LIMIT
    offset_param: str = Constant.OFFSET
    total_size_field: str = ResponseConstant.TOTAL_SIZE
    envelope_field: str | None = None


class PaginatedPage(BaseModel):
    """One validated page of a Data 360 listing endpoint."""

    model_config = ConfigDict(extra="ignore")

    total_size: int
    items: list[dict]

    @classmethod
    def from_payload(cls, payload: dict, paging: EndpointPaging, context: str) -> "PaginatedPage":
        """Validates a raw response against the endpoint's paging contract."""
        body = payload
        if paging.envelope_field:
            envelope = payload.get(paging.envelope_field)
            if not isinstance(envelope, dict):
                raise Data360ResponseError(f"Missing '{paging.envelope_field}' object in {context}")
            body = envelope

        total_size = body.get(paging.total_size_field)
        raw_items = body.get(paging.items_field)
        if total_size is None and raw_items is None:
            # Defaulting the total to 0 stops the paginator after the first page,
            # so a response we cannot count would be reported as the complete
            # listing and everything beyond page one read as deleted.
            raise Data360ResponseError(
                f"Missing both '{paging.total_size_field}' and '{paging.items_field}' in {context}"
            )

        items = list(raw_items or [])
        if total_size is None:
            # The live API omits the total-size field entirely (rather than
            # returning 0) when there are no matching items for this object
            # type/dataspace combination, so an empty items list here is a
            # legitimate empty result, not a malformed response.
            total_size = len(items)

        return cls(total_size=total_size, items=items)
