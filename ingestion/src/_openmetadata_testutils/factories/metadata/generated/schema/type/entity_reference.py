import factory.fuzzy
from pydantic import BaseModel

from _openmetadata_testutils.factories.base.root_model import RootSubFactory
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    UuidFactory,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    Uuid,
)
from metadata.generated.schema.type.entityReference import EntityReference


class Entity(BaseModel):
    id: Uuid
    type: str
    name: EntityName
    fullyQualifiedName: FullyQualifiedEntityName
    description: Markdown


class EntityFactory(factory.Factory):
    id = RootSubFactory(UuidFactory)
    type = "entity"
    name = factory.LazyAttribute(lambda o: o.fullyQualifiedName)
    fullyQualifiedName = factory.fuzzy.FuzzyText()
    description = RootSubFactory(Markdown)

    class Meta:
        model = EntityReference


class EntityReferenceFactory(factory.Factory):
    id = factory.LazyAttribute(lambda x: x.entity.id.root)
    type = factory.LazyAttribute(lambda x: type(x.entity).__name__.lower())
    name = factory.LazyAttribute(lambda x: x.entity.name.root)
    fullyQualifiedName = factory.LazyAttribute(
        lambda x: x.entity.fullyQualifiedName.root
    )
    description = factory.LazyAttribute(lambda x: x.entity.description.root)

    class Meta:
        model = EntityReference

    class Params:
        entity = factory.SubFactory(EntityFactory)
