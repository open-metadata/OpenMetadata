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
"""Test pydantic v2 models serialize data as pydantic v1"""
from datetime import datetime

from pydantic.v1 import BaseModel as BaseModelV1

from metadata.ingestion.models.custom_pydantic import BaseModel


def test_simple_dump():
    """
    Compare V1 and custom V2 serialization,
    due to https://github.com/pydantic/pydantic/issues/8825#issuecomment-1946206415
    """

    class ModelV1(BaseModelV1):
        a: str
        b: int
        date: datetime

    class ModelV2(BaseModel):
        a: str
        b: int
        date: datetime

    data = {"a": "магазин", "b": 1, "date": datetime.now()}

    model_v1 = ModelV1(**data)
    model_v2 = ModelV2(**data)

    json_v1 = model_v1.json()
    json_v2 = model_v2.model_dump_json()

    assert json_v1 == json_v2


def test_nested_dump():
    """Same as above, but with nested items."""

    class NestedV1(BaseModelV1):
        a: str
        b: int

    class ModelV1(BaseModelV1):
        a: str
        nested: NestedV1

    class NestedV2(BaseModel):
        a: str
        b: int

    class ModelV2(BaseModel):
        a: str
        nested: NestedV2

    data = {"a": "магазин", "nested": {"a": "магазин", "b": 1}}

    model_v1 = ModelV1(**data)
    model_v2 = ModelV2(**data)

    json_v1 = model_v1.json()
    json_v2 = model_v2.model_dump_json()

    assert json_v1 == json_v2
