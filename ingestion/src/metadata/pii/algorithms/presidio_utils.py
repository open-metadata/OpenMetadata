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
import atexit
import inspect
import logging
import threading
import weakref
from typing import Dict, Iterable, Optional, Type

import spacy
from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    PatternRecognizer,
    predefined_recognizers,
)
from presidio_analyzer.nlp_engine import SpacyNlpEngine
from spacy.cli.download import download  # pyright: ignore[reportUnknownVariableType]

from metadata.pii.constants import PRESIDIO_LOGGER, SPACY_EN_MODEL, SUPPORTED_LANG
from metadata.utils.logger import METADATA_LOGGER, pii_logger

logger = pii_logger()

# Global cache for AnalyzerEngine instances to prevent memory leaks
_analyzer_cache: Dict[str, weakref.ReferenceType[AnalyzerEngine]] = {}
_cache_lock = threading.Lock()
_spacy_models_cache: Dict[str, weakref.ReferenceType] = {}


def _cleanup_caches():
    """Cleanup function called at exit to clear caches"""
    global _analyzer_cache, _spacy_models_cache
    with _cache_lock:
        _analyzer_cache.clear()
        _spacy_models_cache.clear()


# Register cleanup function
atexit.register(_cleanup_caches)


def clear_presidio_caches():
    """
    Manually clear all Presidio and spaCy caches.
    Useful for memory management in long-running processes.
    """
    _cleanup_caches()
    logger.info("Cleared Presidio and spaCy model caches")


def build_analyzer_engine(
    model_name: str = SPACY_EN_MODEL,
) -> AnalyzerEngine:
    """
    Build a Presidio analyzer engine for the model_name and tailored to our use case.
    Uses caching to prevent memory leaks from multiple instances.

    If the model is not found locally, it will be downloaded.
    """
    cache_key = f"{model_name}_{SUPPORTED_LANG}"

    with _cache_lock:
        # Check if we have a cached instance
        if cache_key in _analyzer_cache:
            cached_ref = _analyzer_cache[cache_key]
            cached_engine = cached_ref()
            if cached_engine is not None:
                logger.debug(f"Reusing cached AnalyzerEngine for {model_name}")
                return cached_engine
            else:
                # Weak reference died, remove from cache
                del _analyzer_cache[cache_key]

        # Create new instance
        logger.debug(f"Creating new AnalyzerEngine for {model_name}")
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
            # Register the recognizer by setting the appropriate language.
            # Presidio recognizers are language-dependent: when analyzing text,
            # Presidio filters recognizers based on the specified language, assuming
            # language-specific patterns (e.g., for country-specific formats).
            # However, our use case involves analyzing structured table data rather than free text,
            # so this language-based approach doesn't always make sense.
            # To fix this, we manually set the recognizer supported language to the one we want.
            recognizer.supported_language = SUPPORTED_LANG
            analyzer_engine.registry.add_recognizer(recognizer)

        # Cache with weak reference to allow garbage collection
        _analyzer_cache[cache_key] = weakref.ref(analyzer_engine)
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
    Load the spaCy model for the given language with caching.
    If the model is not found locally, it will be downloaded.
    """
    # Check cache first
    if model_name in _spacy_models_cache:
        cached_ref = _spacy_models_cache[model_name]
        cached_model = cached_ref()
        if cached_model is not None:
            logger.debug(f"Reusing cached spaCy model: {model_name}")
            return
        else:
            # Weak reference died, remove from cache
            del _spacy_models_cache[model_name]

    try:
        model = spacy.load(model_name)
        # Cache with weak reference
        _spacy_models_cache[model_name] = weakref.ref(model)
        logger.debug(f"Loaded and cached spaCy model: {model_name}")
    except OSError:
        logger.warning(f"Downloading {model_name} language model for spaCy")
        download(model_name)
        model = spacy.load(model_name)
        # Cache the newly downloaded model
        _spacy_models_cache[model_name] = weakref.ref(model)
        logger.debug(f"Downloaded and cached spaCy model: {model_name}")


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
                yield cls(
                    supported_language=SUPPORTED_LANG
                )  # pyright: ignore[reportCallIssue]
            except Exception as e:
                logger.warning(e)
        elif cls == predefined_recognizers.PhoneRecognizer:
            # Not a pattern recognizer, but pretty much the same
            yield predefined_recognizers.PhoneRecognizer()
