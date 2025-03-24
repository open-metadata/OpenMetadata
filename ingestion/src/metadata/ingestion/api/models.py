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
"""
Generic models
"""
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)

Entity = BaseModel

T = TypeVar("T")


class Either(BaseModel, Generic[T]):
    """Any execution should return us Either an Entity of an error for us to handle"""

    left: Annotated[
        Optional[StackTraceError],
        Field(description="Error encountered during execution", default=None),
    ]
    right: Annotated[
        Optional[T], Field(description="Correct instance of an Entity", default=None)
    ]
