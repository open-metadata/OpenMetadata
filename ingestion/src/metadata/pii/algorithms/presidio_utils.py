#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Utilities for working with the Presidio Library.
"""
import inspect
import logging
from typing import Any, Callable, Iterable, List, Optional, Type, Union, cast

import spacy
from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    PatternRecognizer,
    RecognizerRegistry,
    RecognizerResult,
    predefined_recognizers,
)
from presidio_analyzer.nlp_engine import NlpArtifacts, SpacyNlpEngine
from presidio_analyzer.predefined_recognizers import (
    AuTfnRecognizer,
    CreditCardRecognizer,
    UsLicenseRecognizer,
)
from spacy.cli.download import download  # pyright: ignore[reportUnknownVariableType]

from metadata.pii.algorithms import patterns
from metadata.pii.constants import PRESIDIO_LOGGER, SPACY_EN_MODEL, SUPPORTED_LANG
from metadata.utils.dispatch import class_register
from metadata.utils.logger import pii_logger

logger = pii_logger()


def load_nlp_engine(
    model_name: str = SPACY_EN_MODEL, supported_language: str = SUPPORTED_LANG
) -> SpacyNlpEngine:
    _load_spacy_model(model_name)
    model = {
        "lang_code": supported_language,
        "model_name": model_name,
    }
    return SpacyNlpEngine(models=[model])


def build_analyzer_engine(
    model_name: str = SPACY_EN_MODEL,
) -> AnalyzerEngine:
    """
    Build a Presidio analyzer engine for the model_name and tailored to our use case.

    If the model is not found locally, it will be downloaded.
    """
    nlp_engine = load_nlp_engine(
        model_name=model_name, supported_language=SUPPORTED_LANG
    )
    recognizer_registry = RecognizerRegistry(
        recognizers=list(_get_all_pattern_recognizers()),
        supported_languages=[SUPPORTED_LANG],
    )
    analyzer_engine = AnalyzerEngine(
        nlp_engine=nlp_engine,
        supported_languages=[SUPPORTED_LANG],
        registry=recognizer_registry,
    )

    return analyzer_engine


def set_presidio_logger_level(log_level: Union[int, str] = logging.ERROR) -> None:
    """
    Set the presidio logger to talk less about internal entities unless we are debugging.
    """
    logging.getLogger(PRESIDIO_LOGGER).setLevel(log_level)


def _load_spacy_model(model_name: str) -> None:
    """
    Load the spaCy model for the given language.
    If the model is not found locally, it will be downloaded.
    """

    try:
        _ = spacy.load(model_name)
    except OSError:
        logger.warning(f"Downloading {model_name} language model for the spaCy")
        download(model_name)
        _ = spacy.load(model_name)


def _get_all_entity_recognizer_classes() -> Iterable[Type[EntityRecognizer]]:
    """
    Iterate over all subclasses of the `EntityRecognizer` exposed
    in the predefined_recognizers module.
    """
    for name in getattr(predefined_recognizers, "__all__", []):
        obj = getattr(predefined_recognizers, name, None)
        if inspect.isclass(obj) and issubclass(obj, EntityRecognizer):
            yield obj


recognizer_factories = class_register()


class SanitizedCreditCardRecognizer(CreditCardRecognizer):
    def analyze(
        self,
        text: str,
        entities: List[str],
        nlp_artifacts: Optional[NlpArtifacts] = None,
        regex_flags: Optional[int] = None,
    ) -> List[RecognizerResult]:
        return super().analyze(
            self.sanitize_value(text, self.replacement_pairs),
            entities,
            nlp_artifacts,
            regex_flags,
        )


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    CreditCardRecognizer
)
def credit_card_factory(**kwargs: Any) -> SanitizedCreditCardRecognizer:
    return SanitizedCreditCardRecognizer(
        patterns=patterns.credit_cards,
        **kwargs,
    )


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    UsLicenseRecognizer
)
def us_license_factory(**kwargs: Any) -> UsLicenseRecognizer:
    return UsLicenseRecognizer(patterns=patterns.us_driving_license, **kwargs)


@recognizer_factories.add(  # pyright: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
    AuTfnRecognizer
)
def au_tfn_factory(**kwargs: Any) -> AuTfnRecognizer:
    return AuTfnRecognizer(
        patterns=patterns.au_tfn_number,
        **kwargs,
    )


def _get_all_pattern_recognizers() -> Iterable[EntityRecognizer]:
    for cls in _get_all_entity_recognizer_classes():
        if issubclass(cls, PatternRecognizer):
            try:
                # Try to instantiate the recognizer
                factory = cast(
                    Callable[..., PatternRecognizer],
                    recognizer_factories.get(  # pyright: ignore[reportUnknownMemberType]
                        cls, cls
                    ),
                )
                yield factory(supported_language=SUPPORTED_LANG)
            except Exception as e:
                logger.warning(e)
        elif cls == predefined_recognizers.PhoneRecognizer:
            # Not a pattern recognizer, but pretty much the same
            yield predefined_recognizers.PhoneRecognizer()
        elif issubclass(cls, predefined_recognizers.SpacyRecognizer):
            yield cls(supported_language=SUPPORTED_LANG)


def apply_confidence_threshold(
    threshold: float,
) -> Callable[[EntityRecognizer], EntityRecognizer]:
    def decorate_entity_recognizer(recognizer: EntityRecognizer) -> EntityRecognizer:
        original_analyze = recognizer.analyze

        def analyze(
            instance: EntityRecognizer,  # pyright: ignore[reportUnusedParameter]
            text: str,
            entities: List[str],
            nlp_artifacts: NlpArtifacts,
        ) -> List[RecognizerResult]:
            results = original_analyze(text, entities, nlp_artifacts)
            return [result for result in results if result.score >= threshold]

        recognizer.analyze = analyze.__get__(recognizer, type(recognizer))
        return recognizer

    return decorate_entity_recognizer
