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
"""Compatibility and evidence rules for shipped business identifier PII defaults."""

import re

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.predefinedRecognizer import Name, PredefinedRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, Target
from metadata.pii.algorithms.feature_extraction import split_column_name
from metadata.pii.algorithms.presidio_utils import context_matches

_BUSINESS_IDENTIFIERS = frozenset({Name.AuAbnRecognizer, Name.ItVatCodeRecognizer, Name.SgUenRecognizer})
_LEGACY_SENSITIVE = _BUSINESS_IDENTIFIERS | {Name.AuAcnRecognizer}
_LANGUAGE = {
    Name.AuAbnRecognizer: ClassificationLanguage.en,
    Name.AuAcnRecognizer: ClassificationLanguage.en,
    Name.ItVatCodeRecognizer: ClassificationLanguage.it,
    Name.SgUenRecognizer: ClassificationLanguage.en,
}
_IDENTIFYING_COLUMN_CONTEXT = {
    Name.AuAbnRecognizer: ("abn", "australian business number"),
    Name.ItVatCodeRecognizer: ("vat", "partita iva", "piva", "iva"),
    Name.SgUenRecognizer: ("uen", "unique entity number"),
}
_MALFORMED_VAT_PREFIX = re.compile(r"(?i)\wIT[ _-]*$")


def _is_unchanged_default(entry: Recognizer, family: Name, threshold: float) -> bool:
    config = entry.recognizerConfig.root
    return (
        entry.isSystemDefault is True
        and entry.name.root == family.value
        and entry.target is Target.content
        and entry.confidenceThreshold == threshold
        and isinstance(config, PredefinedRecognizer)
        and config.name is family
        and config.supportedLanguage is _LANGUAGE[family]
        and not config.context
        and not config.supportedEntities
    )


def _legacy_family(entry: Recognizer) -> Name | None:
    return next((family for family in _LEGACY_SENSITIVE if _is_unchanged_default(entry, family, 0.6)), None)


def default_non_sensitive_family(tag: Tag, entry: Recognizer) -> Name | None:
    """Identify only the unchanged shipped NonSensitive business recognizers."""
    if tag.fullyQualifiedName != "PII.NonSensitive":
        return None
    return next((family for family in _BUSINESS_IDENTIFIERS if _is_unchanged_default(entry, family, 0.6)), None)


def prepare_default_pii_tags(tags: list[Tag]) -> list[Tag]:
    """Apply new shipped defaults to old stored tags without altering user configurations."""
    sensitive = next((tag for tag in tags if tag.fullyQualifiedName == "PII.Sensitive"), None)
    non_sensitive = next((tag for tag in tags if tag.fullyQualifiedName == "PII.NonSensitive"), None)
    if sensitive is None or non_sensitive is None or sensitive.autoClassificationEnabled is False:
        return tags

    retired = [
        entry
        for entry in sensitive.recognizers or []
        if entry.enabled is not False and _legacy_family(entry) is not None
    ]
    if not retired:
        return tags

    sensitive_copy = sensitive.model_copy(deep=True)
    sensitive_copy.recognizers = [
        entry for entry in sensitive_copy.recognizers or [] if entry.enabled is False or _legacy_family(entry) is None
    ]
    non_sensitive_copy = non_sensitive.model_copy(deep=True)
    existing_names = {entry.name.root for entry in non_sensitive_copy.recognizers or []}
    if non_sensitive_copy.autoClassificationEnabled is not False:
        for entry in retired:
            if (family := _legacy_family(entry)) in _BUSINESS_IDENTIFIERS and family.value not in existing_names:
                migrated = entry.model_copy(deep=True)
                non_sensitive_copy.recognizers = [*(non_sensitive_copy.recognizers or []), migrated]
                existing_names.add(family.value)

    return [sensitive_copy if tag is sensitive else non_sensitive_copy if tag is non_sensitive else tag for tag in tags]


def qualifies_for_default_non_sensitive(family: Name, column_name: str, value: str, start: int, end: int) -> bool:
    """A structural match needs family evidence from the name or an explicit IT VAT prefix."""
    if family is Name.ItVatCodeRecognizer and _MALFORMED_VAT_PREFIX.search(value[:start]):
        return False
    match = value[start:end]
    if family is Name.ItVatCodeRecognizer and match.upper().startswith("IT"):
        return True
    separated_acronyms = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", column_name)
    return context_matches(_IDENTIFYING_COLUMN_CONTEXT[family], split_column_name(separated_acronyms))
