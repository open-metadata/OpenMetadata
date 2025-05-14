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
from typing import Iterable, Optional, Type

import spacy
from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    PatternRecognizer,
    predefined_recognizers,
)
from presidio_analyzer.nlp_engine import SpacyNlpEngine
from spacy.cli import download

from metadata.pii.constants import SPACY_EN_MODEL
from metadata.utils.logger import METADATA_LOGGER, pii_logger

logger = pii_logger()

PRESIDIO_LOGGER = "presidio-analyzer"

# Supported language for Presidio.
# Don't change this unless you know what you are doing.
# We are doing some tricks to make Presidio work for our use case.
SUPPORTED_LANG = "en"


def build_analyzer_engine(
    model_name: str = SPACY_EN_MODEL,
) -> AnalyzerEngine:
    """
    Build a Presidio analyzer engine for the model_name and tailored to our use case.

    If the model is not found locally, it will be downloaded.
    """
    _load_spacy_model(model_name)

    model = {
        "lang_code": SUPPORTED_LANG,
        "model_name": model_name,
    }

    nlp_engine = SpacyNlpEngine(models=[model])
    analyzer_engine = AnalyzerEngine(
        nlp_engine=nlp_engine, supported_languages=[SUPPORTED_LANG]
    )
    for recognizer in _get_all_pattern_recognizers():
        # Add the recognizer to the engine
        recognizer.supported_language = SUPPORTED_LANG
        analyzer_engine.registry.add_recognizer(recognizer)

    return analyzer_engine


def set_presidio_logger_level(log_level: Optional[int] = None) -> None:
    """
    Set the presidio logger to talk less about internal entities unless we are debugging.
    """
    if log_level is None:
        log_level = (
            logging.INFO
            if logging.getLogger(METADATA_LOGGER).level == logging.DEBUG
            else logging.ERROR
        )

    logging.getLogger(PRESIDIO_LOGGER).setLevel(log_level)


def _load_spacy_model(model_name: str) -> None:
    """
    Load the spaCy model for the given language.
    If the model is not found locally, it will be downloaded.
    """

    try:
        spacy.load(model_name)
    except OSError:
        logger.warning(f"Downloading {model_name} language model for the spaCy")
        download(model_name)
        spacy.load(model_name)

    return None


def _get_all_entity_recognizer_classes() -> Iterable[Type[EntityRecognizer]]:
    """
    Iterate over all subclasses of the `EntityRecognizer` exposed
    in the predefined_recognizers module.
    """
    for name in getattr(predefined_recognizers, "__all__", []):
        obj = getattr(predefined_recognizers, name, None)
        if inspect.isclass(obj) and issubclass(obj, EntityRecognizer):
            yield obj


def _get_all_pattern_recognizers() -> Iterable[EntityRecognizer]:
    for cls in _get_all_entity_recognizer_classes():
        if issubclass(cls, PatternRecognizer):
            try:
                # Try to instantiate the recognizer
                yield cls(supported_language=SUPPORTED_LANG)  # type: ignore
            except Exception as e:
                logger.warning(e)
        elif cls == predefined_recognizers.PhoneRecognizer:
            # Not a pattern recognizer, but pretty much the same
            yield predefined_recognizers.PhoneRecognizer()
