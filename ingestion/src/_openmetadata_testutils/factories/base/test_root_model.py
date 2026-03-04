from typing import Any, Mapping

import factory.fuzzy
import pytest
from dirty_equals import HasAttributes, IsInstance, IsPositiveInt, IsStr
from pydantic import BaseModel, RootModel

from _openmetadata_testutils.factories.base.root_model import (
    RootModelFactory,
    RootSubFactory,
)


class IntRoot(RootModel[int]):
    root: int


class IntRootFactory(RootModelFactory):
    root = factory.fuzzy.FuzzyInteger(1, 10)

    class Meta:
        model = IntRoot


@pytest.mark.parametrize(
    "creation_kwargs, expected",
    (
        ({"root": 2}, IntRoot(root=2)),
        ({}, IsInstance(IntRoot) & HasAttributes(root=IsPositiveInt)),
    ),
)
def test_it_builds_the_expected_int_model(
    creation_kwargs: Mapping[str, Any], expected: RootModel
):
    assert IntRootFactory.create(**creation_kwargs) == expected


class FooModel(BaseModel):
    foo: int
    bar: str


class FooModelFactory(factory.Factory):
    foo = factory.fuzzy.FuzzyInteger(1, 10)
    bar = factory.fuzzy.FuzzyText()

    class Meta:
        model = FooModel


class FooRoot(RootModel[FooModel]):
    root: FooModel


class FooRootFactory(RootModelFactory):
    root = factory.SubFactory(FooModelFactory)

    class Meta:
        model = FooRoot


@pytest.mark.parametrize(
    "creation_kwargs, expected",
    (
        ({"foo": 1, "bar": "foobar"}, FooRoot(root=FooModel(foo=1, bar="foobar"))),
        (
            {"root__foo": 1, "bar": "foobar"},
            FooRoot(root=FooModel(foo=1, bar="foobar")),
        ),
        (
            {"foo": 1, "root__bar": "foobar"},
            FooRoot(root=FooModel(foo=1, bar="foobar")),
        ),
        (
            {"root__foo": 1, "root__bar": "foobar"},
            FooRoot(root=FooModel(foo=1, bar="foobar")),
        ),
        (
            {},
            IsInstance(FooRoot)
            & HasAttributes(
                root=IsInstance(FooModel) & HasAttributes(foo=IsPositiveInt, bar=IsStr)
            ),
        ),
        (
            {"foo": 1},
            IsInstance(FooRoot)
            & HasAttributes(
                root=IsInstance(FooModel) & HasAttributes(foo=1, bar=IsStr)
            ),
        ),
        (
            {"root__foo": 1},
            IsInstance(FooRoot)
            & HasAttributes(
                root=IsInstance(FooModel) & HasAttributes(foo=1, bar=IsStr)
            ),
        ),
        (
            {"bar": "foobar"},
            IsInstance(FooRoot)
            & HasAttributes(
                root=IsInstance(FooModel)
                & HasAttributes(foo=IsPositiveInt, bar="foobar")
            ),
        ),
        (
            {"root__bar": "foobar"},
            IsInstance(FooRoot)
            & HasAttributes(
                root=IsInstance(FooModel)
                & HasAttributes(foo=IsPositiveInt, bar="foobar")
            ),
        ),
    ),
)
def test_it_builds_the_expected_foo_root_model(
    creation_kwargs: Mapping[str, Any], expected: RootModel
):
    assert FooRootFactory.create(**creation_kwargs) == expected


class FoobarModel(BaseModel):
    foo: IntRoot
    bar: FooRoot


class FoobarModelFactory(factory.Factory):
    foo = RootSubFactory(IntRootFactory)
    bar = RootSubFactory(FooRootFactory)

    class Meta:
        model = FoobarModel


@pytest.mark.parametrize(
    "creation_kwargs, expected",
    (
        (
            {
                "foo": 1,
                "bar__foo": 1,
                "bar__bar": "foobar",
            },
            FoobarModel(
                foo=IntRoot(root=1),
                bar=FooRoot(
                    root=FooModel(
                        foo=1,
                        bar="foobar",
                    )
                ),
            ),
        ),
        (
            {
                "foo__root": 1,
                "bar__root__foo": 1,
                "bar__root__bar": "foobar",
            },
            FoobarModel(
                foo=IntRoot(root=1),
                bar=FooRoot(
                    root=FooModel(
                        foo=1,
                        bar="foobar",
                    )
                ),
            ),
        ),
    ),
)
def test_it_builds_the_expected_foobar_model(
    creation_kwargs: Mapping[str, Any], expected: RootModel
):
    assert FoobarModelFactory.create(**creation_kwargs) == expected


class FQN(BaseModel):
    root: str


class FQNFactory(factory.Factory):
    root = factory.LazyAttribute(lambda o: f"{o.parent}.{o.name}")

    class Meta:
        model = FQN

    class Params:
        name = "Name"
        parent = "Parent"


def test_it_creates_objects_when_root_factory_has_params():
    assert FQNFactory.create(parent="Foo", name="Bar") == FQN(root="Foo.Bar")


class Entity(BaseModel):
    fqn: FQN


class EntityFactory(factory.Factory):
    fqn = RootSubFactory(FQNFactory)

    class Meta:
        model = Entity


def test_it_creates_objects_with_root_factory_when_root_factory_has_params():
    assert EntityFactory.create(fqn__parent="Foo", fqn__name="Bar") == Entity(
        fqn=FQN(root="Foo.Bar")
    )
