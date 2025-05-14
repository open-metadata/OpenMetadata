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
import inspect
import logging
import re
from collections import defaultdict
from typing import (
    Dict,
    FrozenSet,
    Hashable,
    Iterable,
    Mapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    TypeVar,
)

from presidio_analyzer import (
    EntityRecognizer,
    PatternRecognizer,
    predefined_recognizers,
)

from metadata.pii.tags import PIITag, SensitivityLevel, pii_tag_to_sensitivity_level

T = TypeVar("T", bound=Hashable)


class PresidioPIITagsExtractor:
    """
    Presidio is used to detect PII without relying on external NLP models
    (e.g., spaCy), in line with our constraint to avoid such heavy dependencies.
    As a result, entities like Person, Location, and NRP are not recognized
    at this stage. These can be handled later in the pipeline using column metadata
    or, if needed, by using external calls to LLMs.
    """

    def __init__(self) -> None:
        self._str_entities = frozenset(entity.value for entity in PIITag)
        self._entities = frozenset(PIITag)
        self._recognizers = self._retrieve_recognizers(self._str_entities)

    def extract_from_single_text(
        self,
        text: str,
    ) -> Mapping[PIITag, float]:
        """
        Extract PII entities from a single text.
        """
        entity_scores = defaultdict(float)

        for recognizer in self._recognizers:
            for recognizer_result in recognizer.analyze(
                text,
                entities=[],
                # The value for the entities is apparently irrelevant here
                nlp_artifacts=None,  # type: ignore
            ):
                pii_entity = PIITag[recognizer_result.entity_type]
                entity_scores[pii_entity] += recognizer_result.score

        return entity_scores

    def extract(
        self,
        texts: Sequence[str],
    ) -> Mapping[PIITag, float]:
        """
        Extract PII entities from a batch of texts.

        The results are averaged over the batch. In general, the larger the batch,
        the better the results as some single texts might be noisy or detected by
        different recognizers.
        """
        # Apply extract to each text in the batch
        results = defaultdict(float)
        for text in texts:
            entity_scores = self.extract_from_single_text(text)
            for entity, score in entity_scores.items():
                results[entity] += score
        # Normalize the scores by the number of texts
        for entity in results:
            results[entity] /= len(texts)
        return results

    def get_recognized_entities(self) -> Set[PIITag]:
        """
        Return the set of entities that can recognized by the analyzer.

        By construction, the returned set must be a subset of the entities passed to the constructor.
        """
        supported_entities = set()

        for recognizer in self._recognizers:
            supported_entities.update(recognizer.get_supported_entities())

        return {PIITag[value] for value in supported_entities}

    def get_unrecognized_entities(self) -> Set[PIITag]:
        """
        Return the set of entities given to the analyzer that cannot be recognized.
        """

        return set(self._entities) - self.get_recognized_entities()

    @classmethod
    def _retrieve_recognizers(
        cls, entities: FrozenSet[str]
    ) -> Sequence[EntityRecognizer]:
        """
        Return the pattern recognizers used for scoring.
        """
        recognizers = []

        for name in getattr(predefined_recognizers, "__all__", []):
            obj = getattr(predefined_recognizers, name, None)
            if inspect.isclass(obj) and issubclass(obj, EntityRecognizer):
                entity_recognizer = cls._instantiate_entity_recognizer(obj)
                if entity_recognizer is None:
                    continue
                # We allow whose supported entities are a subset of the PII entities
                # to prevent KeyErrors when trying to retrieve the entity type by name
                if set(entity_recognizer.get_supported_entities()) <= entities:
                    recognizers.append(entity_recognizer)

        return recognizers

    @staticmethod
    def _instantiate_entity_recognizer(
        type_: Type[EntityRecognizer],
    ) -> Optional[EntityRecognizer]:
        # We consider only recognizers that don't need NLP engine
        if issubclass(type_, PatternRecognizer):
            try:
                # Try to instantiate the recognizer
                recognizer = type_()  # type: ignore
                return recognizer
            except Exception as e:
                logging.exception(e)
                # TODO: log this
        elif type_ == predefined_recognizers.PhoneRecognizer:
            # This is a special case, as PhoneRecognizer is not a subclass of PatternRecognizer
            return predefined_recognizers.PhoneRecognizer()

        return None


def extract_entities_from_regexes(
    patterns: Mapping[T, Set[re.Pattern]], text: str
) -> Set[T]:
    results = set()
    for pii_type, patterns in patterns.items():
        for pattern in patterns:
            if pattern.match(text) is not None:
                results.add(pii_type)
    return results


def pii_column_name_regexes() -> Mapping[PIITag, Set[re.Pattern]]:
    """
    Analyzes column names for PII patterns.
    A match is considered as a potential PII, but not a guarantee.
    Think of it as a hint that the column might contain PII.
    """
    raw_patterns = [
        (PIITag.US_SSN, "^.*(ssn|social).*$"),
        (PIITag.CREDIT_CARD, "^.*(credit).*(card).*$"),
        (PIITag.IBAN_CODE, "^.*bank.*(acc|num).*$"),
        (PIITag.US_BANK_NUMBER, "^.*bank.*(acc|num).*$"),
        (PIITag.EMAIL_ADDRESS, "^(email|e-mail|mail)(.*address)?$"),
        (PIITag.PERSON, "^.*(user|client|person|first|last|maiden|nick).*(name).*$"),
        (PIITag.DATE_TIME, "^.*(date|time|dob|birthday|dod).*$"),
        (PIITag.NRP, "^.*(gender|nationality).*$"),
        (
            PIITag.LOCATION,
            "^.*(address|city|state|county|country|zipcode|zip|postal|zone|borough).*$",
        ),
        (PIITag.PHONE_NUMBER, "^.*(phone).*$"),
    ]

    return _compile_and_group_raw_patterns(raw_patterns)


def sensitivity_level_column_name_regexes() -> Mapping[
    SensitivityLevel, Set[re.Pattern]
]:
    """
    Sensitivity level regexes for column names.

    We sometimes abuse the term PII Sensitive to refer to any kind of sensitive data,
    even if it is not PII, like passwords.
    """
    pattern_map: Dict[SensitivityLevel, Set[re.Pattern]] = defaultdict(set)

    non_pii_sensitive = _compile_and_group_raw_patterns(
        [
            (SensitivityLevel.SENSITIVE, "^.*password.*$"),
            # Add more non-PII sensitive patterns here
            # or non-sensitive non-PII patterns if needed
        ]
    )

    for sensitivity_level, patterns in non_pii_sensitive.items():
        pattern_map[sensitivity_level] |= patterns

    # Add derived patterns from PII tags

    for pii_type, patterns in pii_column_name_regexes().items():
        sensitivity_level = pii_tag_to_sensitivity_level(pii_type)
        pattern_map[sensitivity_level] |= patterns

    return pattern_map


def _compile_and_group_raw_patterns(
    patterns: Iterable[Tuple[T, str]]
) -> Mapping[T, Set[re.Pattern]]:
    """
    Compile the regex patterns and group them by the linked entity.
    """
    compiled_patterns = defaultdict(set)

    for pii_type, pattern in patterns:
        compiled_patterns[pii_type].add(re.compile(pattern, re.IGNORECASE))

    return compiled_patterns
