#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Release-pinned spaCy model selection for auto classification."""

from collections.abc import Iterable
from dataclasses import dataclass

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.constants import LANGUAGE_MODEL_MAPPING, SPACY_MULTILANG_MODEL

MODEL_VERSION = "3.8.0"
MODEL_SPACY_VERSION = ">=3.8.0,<3.9.0"


class ClassificationLanguageSelectionError(ValueError):
    """The requested language selection is not valid for provisioning."""


@dataclass(frozen=True)
class ModelSpecification:
    """A release-pinned spaCy model artifact."""

    name: str
    version: str
    spacy_version: str

    @property
    def wheel_url(self) -> str:
        release = f"{self.name}-{self.version}"
        return f"https://github.com/explosion/spacy-models/releases/download/{release}/{release}-py3-none-any.whl"


MODEL_SPECS = {
    name: ModelSpecification(name, MODEL_VERSION, MODEL_SPACY_VERSION)
    for name in (
        "ca_core_news_md",
        "da_core_news_md",
        "de_core_news_md",
        "el_core_news_md",
        "en_core_web_md",
        "es_core_news_md",
        "fi_core_news_md",
        "fr_core_news_md",
        "hr_core_news_md",
        "it_core_news_md",
        "ja_core_news_md",
        "ko_core_news_md",
        "lt_core_news_md",
        "mk_core_news_md",
        "nb_core_news_md",
        "nl_core_news_md",
        "pl_core_news_md",
        "pt_core_news_md",
        "ro_core_news_md",
        "ru_core_news_md",
        "sl_core_news_md",
        "sv_core_news_md",
        "uk_core_news_md",
        "xx_ent_wiki_sm",
        "zh_core_web_md",
    )
}


def parse_classification_languages(value: str) -> list[ClassificationLanguage]:
    """Parse a comma-separated selection without accepting aliases or empty values."""
    if not value or not value.strip():
        raise ClassificationLanguageSelectionError("--languages must include at least one language")

    languages: list[ClassificationLanguage] = []
    for identifier in value.split(","):
        language = identifier.strip()
        if not language:
            raise ClassificationLanguageSelectionError("--languages cannot contain an empty language")
        try:
            languages.append(ClassificationLanguage(language))
        except ValueError as exc:
            raise ClassificationLanguageSelectionError(
                f"Unsupported classification language '{language}'. Use an exact ClassificationLanguage identifier."
            ) from exc
    return languages


def get_model_for_language(language: ClassificationLanguage) -> str:
    """Return the existing configured model or the multilingual fallback."""
    return LANGUAGE_MODEL_MAPPING.get(language, SPACY_MULTILANG_MODEL)


def get_model_specification(model_name: str) -> ModelSpecification:
    """Return the provisionable release for a configured model."""
    try:
        return MODEL_SPECS[model_name]
    except KeyError as exc:
        raise ValueError(f"No provisionable model is configured for '{model_name}'") from exc


def resolve_model_specifications(
    languages: Iterable[ClassificationLanguage],
) -> list[ModelSpecification]:
    """Resolve languages to unique model releases in first-selection order."""
    specifications: list[ModelSpecification] = []
    selected_models: set[str] = set()
    for language in languages:
        specification = get_model_specification(get_model_for_language(language))
        if specification.name not in selected_models:
            specifications.append(specification)
            selected_models.add(specification.name)
    return specifications


def languages_by_model(
    languages: Iterable[ClassificationLanguage],
) -> dict[str, list[str]]:
    """Group selected language identifiers by their resolved model."""
    selected: dict[str, list[str]] = {}
    for language in languages:
        model_name = get_model_for_language(language)
        selected.setdefault(model_name, []).append(language.value)
    return selected


def example_language_for_model(model_name: str) -> str | None:
    """Return a valid provisioning example for a configured model when known."""
    # Prefer English for the shared model because `any` can require additional recognizer languages.
    if model_name == get_model_for_language(ClassificationLanguage.en):
        return ClassificationLanguage.en.value
    for language in ClassificationLanguage:
        if get_model_for_language(language) == model_name:
            return language.value
    return None
