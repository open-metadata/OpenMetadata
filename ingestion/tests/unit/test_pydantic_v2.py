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

from pydantic import AnyUrl
from pydantic.v1 import BaseModel as BaseModelV1

from metadata.generated.schema.type.basic import DateTime
from metadata.ingestion.models.custom_pydantic import BaseModel, CustomSecretStr


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


def test_tz_aware_date():
    """Validate how we can create "aware" datetime objects"""

    DateTime(datetime.now())


def test_any_url():
    """It always ends with /"""
    assert str(AnyUrl("https://example.com")) == "https://example.com/"
    assert str(AnyUrl("https://example.com/")) == "https://example.com/"


def test_get_secret_string():
    """We can get the right secret from our custom CustomSecretStr"""
    from metadata.ingestion.models.custom_pydantic import CustomSecretStr

    class MyModel(BaseModel):
        secret: CustomSecretStr
        no_secret: str

    model = MyModel(secret="password", no_secret="hello")

    assert model.secret.get_secret_value() == "password"

    # key is shown when serialized
    assert model.model_dump()["secret"] == "password"


def test_model_dump_masked():
    """Test model_dump_masked with root, nested, and list structures."""

    class NestedModel(BaseModel):
        secret: CustomSecretStr
        value: int

    class RootModel(BaseModel):
        root_secret: CustomSecretStr
        nested: NestedModel
        items: list[NestedModel]

    data = {
        "root_secret": "root_password",
        "nested": {"secret": "nested_password", "value": 42},
        "items": [
            {"secret": "item1_password", "value": 1},
            {"secret": "item2_password", "value": 2},
        ],
    }

    model = RootModel(**data)
    masked_data = model.model_dump_masked()

    assert masked_data["root_secret"] == "*******"
    assert masked_data["nested"]["secret"] == "*******"
    assert masked_data["nested"]["value"] == 42
    assert masked_data["items"][0]["secret"] == "*******"
    assert masked_data["items"][0]["value"] == 1
    assert masked_data["items"][1]["secret"] == "*******"
    assert masked_data["items"][1]["value"] == 2
