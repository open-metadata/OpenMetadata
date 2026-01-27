import factory.fuzzy

from _openmetadata_testutils.factories.base.root_model import RootModelFactory
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)


class TagFQNFactory(RootModelFactory):
    root = factory.LazyAttribute(lambda o: f"{o.parent}.{o.tag}")

    class Meta:
        model = TagFQN

    class Params:
        tag = factory.fuzzy.FuzzyText(prefix="Tag-", length=3)
        parent = factory.fuzzy.FuzzyText(prefix="Parent-", length=3)


class TagLabelFactory(factory.Factory):
    tagFQN = factory.LazyAttribute(lambda o: TagFQNFactory(tag=o.name, parent=o.parent))
    name = factory.fuzzy.FuzzyText(prefix="Tag-", length=3)
    source = factory.fuzzy.FuzzyChoice(TagSource)
    labelType = factory.fuzzy.FuzzyChoice(LabelType)
    state = factory.fuzzy.FuzzyChoice(State)
    reason = factory.Faker("text")

    class Meta:
        model = TagLabel

    class Params:
        parent = factory.fuzzy.FuzzyText(prefix="Parent-", length=3)

        # Tag Source
        classification = factory.Trait(source=TagSource.Classification)
        glossary = factory.Trait(source=TagSource.Glossary)

        # Label Type
        manual = factory.Trait(labelType=LabelType.Manual)
        propagated = factory.Trait(labelType=LabelType.Propagated)
        automated = factory.Trait(labelType=LabelType.Automated)
        derived = factory.Trait(labelType=LabelType.Derived)
        generated = factory.Trait(labelType=LabelType.Generated)

        # State
        suggested = factory.Trait(state=State.Suggested)
        confirmed = factory.Trait(state=State.Confirmed)
