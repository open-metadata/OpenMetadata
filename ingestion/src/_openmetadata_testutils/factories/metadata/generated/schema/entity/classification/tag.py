import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootSubFactory
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    MarkdownFactory,
    UuidFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.entity_reference import (
    EntityReferenceFactory,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.basic import EntityName


class TagFactory(factory.Factory):
    id = RootSubFactory(UuidFactory)
    name = factory.LazyAttribute(lambda o: EntityName(root=o.tag_name))
    fullyQualifiedName = factory.LazyAttribute(
        lambda o: f"{o.tag_classification.fullyQualifiedName.root}.{o.tag_name}"
    )
    classification = factory.LazyAttribute(
        lambda o: EntityReferenceFactory(entity=o.tag_classification)
        if o.tag_classification
        else None
    )
    description = RootSubFactory(MarkdownFactory)
    recognizers = factory.LazyFunction(list)
    autoClassificationEnabled = True
    autoClassificationPriority = 80

    class Meta:
        model = Tag

    class Params:
        tag_name = factory.fuzzy.FuzzyText(prefix="Tag-", length=5)
        tag_classification = factory.SubFactory(ClassificationFactory)
