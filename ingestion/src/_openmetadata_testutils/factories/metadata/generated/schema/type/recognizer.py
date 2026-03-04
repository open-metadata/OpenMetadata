import factory.fuzzy

from _openmetadata_testutils.factories.base.polymorphic_subfactory import (
    PolymorphicSubFactory,
)
from _openmetadata_testutils.factories.base.root_model import (
    RootModelFactory,
    RootSubFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    EntityNameFactory,
    MarkdownFactory,
    UuidFactory,
)
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.contextRecognizer import ContextRecognizer
from metadata.generated.schema.type.customRecognizer import CustomRecognizer
from metadata.generated.schema.type.exactTermsRecognizer import ExactTermsRecognizer
from metadata.generated.schema.type.patternRecognizer import PatternRecognizer
from metadata.generated.schema.type.predefinedRecognizer import Name as PredefinedName
from metadata.generated.schema.type.predefinedRecognizer import PredefinedRecognizer
from metadata.generated.schema.type.recognizer import (
    Recognizer,
    RecognizerConfig,
    Target,
)
from metadata.generated.schema.type.recognizers.patterns import Pattern
from metadata.generated.schema.type.recognizers.regexFlags import RegexFlags


class PatternFactory(factory.Factory):
    name = factory.fuzzy.FuzzyText()
    regex = factory.fuzzy.FuzzyText()
    score = 0.8

    class Meta:
        model = Pattern


class RegexFlagsFactory(factory.Factory):
    dotAll = True
    multiline = True
    ignoreCase = True

    class Meta:
        model = RegexFlags


class PatternRecognizerFactory(factory.Factory):
    type = "pattern"
    patterns = factory.List([factory.SubFactory(PatternFactory)])
    regexFlags = factory.SubFactory(RegexFlagsFactory)
    context = factory.LazyFunction(lambda: ["email", "contact"])
    supportedLanguage = ClassificationLanguage.en

    class Meta:
        model = PatternRecognizer


class ExactTermsRecognizerFactory(factory.Factory):
    type = "exact_terms"
    exactTerms = factory.LazyFunction(lambda: ["sensitive", "confidential"])
    supportedLanguage = ClassificationLanguage.en
    regexFlags = factory.SubFactory(RegexFlagsFactory)

    class Meta:
        model = ExactTermsRecognizer


class ContextRecognizerFactory(factory.Factory):
    type = "context"
    contextWords = factory.LazyFunction(lambda: ["ssn", "social security"])
    supportedLanguage = ClassificationLanguage.en
    minScore = 0.4
    maxScore = 0.8
    increaseFactorByCharLength = 0.05

    class Meta:
        model = ContextRecognizer


class PredefinedRecognizerFactory(factory.Factory):
    type = "predefined"
    name = PredefinedName.EmailRecognizer
    supportedLanguage = ClassificationLanguage.en
    context = factory.LazyFunction(lambda: [])
    supportedEntities = None

    class Meta:
        model = PredefinedRecognizer


class CustomRecognizerFactory(factory.Factory):
    type = "custom"
    validatorFunction = factory.fuzzy.FuzzyText()
    supportedLanguage = ClassificationLanguage.en

    class Meta:
        model = CustomRecognizer


class RecognizerConfigFactory(RootModelFactory):
    root = PolymorphicSubFactory(
        subfactories={
            "pattern": factory.SubFactory(PatternRecognizerFactory),
            "exact_terms": factory.SubFactory(ExactTermsRecognizerFactory),
            "context": factory.SubFactory(ContextRecognizerFactory),
            "predefined": factory.SubFactory(PredefinedRecognizerFactory),
            "custom": factory.SubFactory(CustomRecognizerFactory),
        },
        default="predefined",
        discriminator_name="type",
    )

    class Meta:
        model = RecognizerConfig


class RecognizerFactory(factory.Factory):
    id = RootSubFactory(UuidFactory)
    name = RootSubFactory(EntityNameFactory)
    description = RootSubFactory(MarkdownFactory)
    enabled = True
    isSystemDefault = False
    recognizerConfig = RootSubFactory(RecognizerConfigFactory)
    confidenceThreshold = 0.6
    exceptionList = factory.LazyFunction(lambda: [])
    target = Target.content

    class Meta:
        model = Recognizer

    class Params:
        predefined = factory.Trait(recognizerConfig__type="predefined")

        exact_terms = factory.Trait(recognizerConfig__type="exact_terms")

        context_based = factory.Trait(recognizerConfig__type="context")

        pattern_based = factory.Trait(recognizerConfig__type="pattern")

        for_column_name = factory.Trait(target=Target.column_name)
