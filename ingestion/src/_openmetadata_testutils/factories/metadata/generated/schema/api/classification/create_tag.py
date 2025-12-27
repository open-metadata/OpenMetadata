import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootSubFactory
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    MarkdownFactory,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.type.basic import EntityName


class CreateTagRequestFactory(factory.Factory):
    name = factory.LazyAttribute(lambda o: EntityName(root=o.tag_name))
    classification = factory.LazyAttribute(lambda o: o.tag_classification)
    description = RootSubFactory(MarkdownFactory)
    recognizers = factory.LazyFunction(list)
    autoClassificationEnabled = True
    autoClassificationPriority = 80

    class Meta:
        model = CreateTagRequest

    class Params:
        tag_name = factory.fuzzy.FuzzyText(prefix="Tag-", length=5)
        tag_classification = factory.fuzzy.FuzzyText(prefix="Classification-", length=5)
