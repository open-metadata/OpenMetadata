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

import pytest

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.model_registry import (
    MODEL_SPECS,
    ClassificationLanguageSelectionError,
    example_language_for_model,
    get_model_for_language,
    get_model_specification,
    languages_by_model,
    parse_classification_languages,
    resolve_model_specifications,
)


class TestClassificationLanguageSelection:
    def test_parses_exact_identifiers_with_surrounding_whitespace(self):
        assert parse_classification_languages(" en, es ") == [
            ClassificationLanguage.en,
            ClassificationLanguage.es,
        ]

    @pytest.mark.parametrize("languages", ["", " ,en", "en,", "en,,es", "EN", "english"])
    def test_rejects_empty_or_unknown_identifiers(self, languages):
        with pytest.raises(ClassificationLanguageSelectionError):
            parse_classification_languages(languages)

    def test_resolves_and_deduplicates_by_first_model_selection(self):
        specifications = resolve_model_specifications(
            [
                ClassificationLanguage.en,
                ClassificationLanguage.any,
                ClassificationLanguage.es,
                ClassificationLanguage.en,
            ]
        )

        assert [specification.name for specification in specifications] == [
            "en_core_web_md",
            "es_core_news_md",
        ]

    def test_unmapped_languages_share_the_multilingual_model(self):
        specifications = resolve_model_specifications([ClassificationLanguage.ar, ClassificationLanguage.hi])

        assert [specification.name for specification in specifications] == ["xx_ent_wiki_sm"]

    def test_keeps_norwegian_alias_and_all_declared_languages_resolvable(self):
        assert resolve_model_specifications([ClassificationLanguage.no])[0].name == "nb_core_news_md"
        assert MODEL_SPECS
        for language in ClassificationLanguage:
            assert resolve_model_specifications([language])[0].name in MODEL_SPECS

    def test_does_not_invent_an_example_language_for_unknown_models(self):
        assert example_language_for_model("internal_model") is None

    def test_returns_examples_for_english_and_multilingual_models(self):
        assert example_language_for_model("en_core_web_md") == "en"
        multilingual_example = example_language_for_model("xx_ent_wiki_sm")
        assert multilingual_example is not None
        assert get_model_for_language(ClassificationLanguage(multilingual_example)) == "xx_ent_wiki_sm"

    def test_rejects_models_missing_from_the_release_registry(self):
        with pytest.raises(ValueError, match="No provisionable model"):
            get_model_specification("unknown_model")

    def test_groups_requested_languages_for_model_diagnostics(self):
        assert languages_by_model([ClassificationLanguage.en, ClassificationLanguage.any]) == {
            "en_core_web_md": ["en", "any"]
        }
