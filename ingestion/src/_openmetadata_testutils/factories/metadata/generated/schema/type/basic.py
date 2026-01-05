import uuid

import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootModelFactory
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    Uuid,
)


class UuidFactory(RootModelFactory):
    root = factory.LazyFunction(uuid.uuid4)

    class Meta:
        model = Uuid


class MarkdownFactory(RootModelFactory):
    root = factory.fuzzy.FuzzyText()

    class Meta:
        model = Markdown


class EntityNameFactory(RootModelFactory):
    root = factory.fuzzy.FuzzyText()

    class Meta:
        model = EntityName


class FullyQualifiedEntityNameFactory(RootModelFactory):
    root = factory.fuzzy.FuzzyText()

    class Meta:
        model = FullyQualifiedEntityName
