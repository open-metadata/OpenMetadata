import factory.fuzzy

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from metadata.pii.models import ScoredTag


class ScoredTagFactory(factory.Factory):
    tag = factory.SubFactory(TagFactory)
    score = 0.8
    reason = factory.fuzzy.FuzzyText(prefix="Detected by recognizer: ")

    class Meta:
        model = ScoredTag
