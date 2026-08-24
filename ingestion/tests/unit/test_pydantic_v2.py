#  Copyright 2022 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Test pydantic v2 models serialize data as pydantic v1"""

import subprocess
import sys
from datetime import datetime

from pydantic import AnyUrl
from pydantic.v1 import BaseModel as BaseModelV1

from metadata.generated.schema.type.basic import DateTime
from metadata.ingestion.models.custom_pydantic import BaseModel


def test_custom_base_model_imports_without_pydantic_212_deprecations():
    """Keep import-time validators on supported Pydantic APIs."""
    script = """
import warnings

from pydantic.warnings import PydanticDeprecatedSince212

warnings.simplefilter("error", PydanticDeprecatedSince212)
import metadata.ingestion.models.custom_pydantic
"""

    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        check=False,
        text=True,
    )

    assert result.returncode == 0, result.stderr


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


def test_serialize_as_any_includes_subclass_fields():
    """Preserve polymorphic serialization exposed by the custom base model."""

    class Parent(BaseModel):
        name: str

    class Child(Parent):
        token: str

    class Container(BaseModel):
        user: Parent

    model = Container(user=Child(name="name", token="token"))

    assert model.model_dump() == {"user": {"name": "name"}}
    assert model.model_dump(serialize_as_any=True) == {"user": {"name": "name", "token": "token"}}


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
