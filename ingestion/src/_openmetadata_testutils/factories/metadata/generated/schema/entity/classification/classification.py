import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootSubFactory
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    MarkdownFactory,
    UuidFactory,
)
from metadata.generated.schema.entity.classification.classification import (
    AutoClassificationConfig,
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName


class AutoClassificationConfigFactory(factory.Factory):
    enabled = True
    conflictResolution = ConflictResolution.highest_confidence  # noqa: N815
    minimumConfidence = 0.6  # noqa: N815

    class Meta:
        model = AutoClassificationConfig


class ClassificationFactory(factory.Factory):
    id = RootSubFactory(UuidFactory)
    name = factory.LazyAttribute(lambda o: EntityName(root=o.fqn))
    fullyQualifiedName = factory.LazyAttribute(lambda o: FullyQualifiedEntityName(root=o.fqn))  # noqa: N815
    description = RootSubFactory(MarkdownFactory)
    mutuallyExclusive = True  # noqa: N815
    autoClassificationConfig = factory.SubFactory(AutoClassificationConfigFactory)  # noqa: N815

    class Meta:
        model = Classification

    class Params:
        fqn = factory.fuzzy.FuzzyText(prefix="Classification-", length=5)
