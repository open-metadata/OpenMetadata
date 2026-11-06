import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootSubFactory
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    MarkdownFactory,
)
from metadata.generated.schema.api.classification.createClassification import (
    AutoClassificationConfig,
    ConflictResolution,
    CreateClassificationRequest,
)
from metadata.generated.schema.type.basic import EntityName


class AutoClassificationConfigFactory(factory.Factory):
    enabled = True
    conflictResolution = ConflictResolution.highest_confidence  # noqa: N815
    minimumConfidence = 0.6  # noqa: N815

    class Meta:
        model = AutoClassificationConfig


class CreateClassificationRequestFactory(factory.Factory):
    name = factory.LazyAttribute(lambda o: EntityName(root=o.fqn))
    description = RootSubFactory(MarkdownFactory)
    mutuallyExclusive = True  # noqa: N815
    autoClassificationConfig = factory.SubFactory(AutoClassificationConfigFactory)  # noqa: N815

    class Meta:
        model = CreateClassificationRequest

    class Params:
        fqn = factory.fuzzy.FuzzyText(prefix="Classification-", length=5)
