from typing import Any, Mapping, Union

import factory.fuzzy
import pytest
from dirty_equals import HasAttributes, IsInstance, IsPositiveInt, IsStr
from pydantic import BaseModel

from _openmetadata_testutils.factories.base.polymorphic_subfactory import (
    PolymorphicSubFactory,
)


class Foo(BaseModel):
    foo: int


class Bar(BaseModel):
    bar: str


class FooBar(BaseModel):
    foo_or_bar: Union[Foo, Bar]


class FooFactory(factory.Factory):
    foo = factory.fuzzy.FuzzyInteger(1, 10)

    class Meta:
        model = Foo


class BarFactory(factory.Factory):
    bar = factory.fuzzy.FuzzyText()

    class Meta:
        model = Bar


class FooBarFactory(factory.Factory):
    foo_or_bar = PolymorphicSubFactory(
        {
            "foo": factory.SubFactory(FooFactory),
            "bar": factory.SubFactory(BarFactory),
        },
        default="foo",
    )

    class Meta:
        model = FooBar


@pytest.mark.parametrize(
    "creation_kwargs, expected",
    (
        ({"foo_or_bar__foo": 1}, FooBar(foo_or_bar=Foo(foo=1))),
        (
            {"foo_or_bar__bar": "bar", "foo_or_bar__type": "bar"},
            FooBar(foo_or_bar=Bar(bar="bar")),
        ),
        (
            {},
            IsInstance(FooBar)
            & HasAttributes(
                foo_or_bar=IsInstance(Foo) & HasAttributes(foo=IsPositiveInt)
            ),
        ),
        (
            {"foo_or_bar__type": "bar"},
            IsInstance(FooBar)
            & HasAttributes(foo_or_bar=IsInstance(Bar) & HasAttributes(bar=IsStr)),
        ),
    ),
)
def test_it_creates_model_with_specific_subfactory(
    creation_kwargs: Mapping[str, Any], expected: BaseModel
):
    assert FooBarFactory.create(**creation_kwargs) == expected
