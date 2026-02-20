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
PII constants
"""
from collections import defaultdict

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)

PII = "PII"

# Constants for Presidio
PRESIDIO_LOGGER = "presidio-analyzer"
SPACY_EN_MODEL = "en_core_web_md"
SPACY_MULTILANG_MODEL = "xx_ent_wiki_sm"

# Supported language for Presidio.
# Don't change this unless you know what you are doing.
# We are doing some tricks to make Presidio work for our use case.
SUPPORTED_LANG = "en"

LANGUAGE_MODEL_MAPPING = defaultdict(
    lambda: SPACY_MULTILANG_MODEL,
    {
        ClassificationLanguage.any: SPACY_EN_MODEL,
        ClassificationLanguage.ca: "ca_core_news_md",
        ClassificationLanguage.zh: "zh_core_web_md",
        ClassificationLanguage.hr: "hr_core_news_md",
        ClassificationLanguage.da: "da_core_news_md",
        ClassificationLanguage.nl: "nl_core_news_md",
        ClassificationLanguage.en: "en_core_web_md",
        ClassificationLanguage.fi: "fi_core_news_md",
        ClassificationLanguage.fr: "fr_core_news_md",
        ClassificationLanguage.de: "de_core_news_md",
        ClassificationLanguage.el: "el_core_news_md",
        ClassificationLanguage.it: "it_core_news_md",
        ClassificationLanguage.ja: "ja_core_news_md",
        ClassificationLanguage.ko: "ko_core_news_md",
        ClassificationLanguage.lt: "lt_core_news_md",
        ClassificationLanguage.mk: "mk_core_news_md",
        ClassificationLanguage.no: "nb_core_news_md",
        ClassificationLanguage.pl: "pl_core_news_md",
        ClassificationLanguage.pt: "pt_core_news_md",
        ClassificationLanguage.ro: "ro_core_news_md",
        ClassificationLanguage.ru: "ru_core_news_md",
        ClassificationLanguage.sl: "sl_core_news_md",
        ClassificationLanguage.es: "es_core_news_md",
        ClassificationLanguage.sv: "sv_core_news_md",
        ClassificationLanguage.uk: "uk_core_news_md",
    },
)
