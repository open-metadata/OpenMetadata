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

from metadata.pii.feature_extraction import PresidioPIITagsExtractor
from metadata.pii.tags import PIITag


def test_presidio_pii_tag_extractor_analyzer_only_misses_nlp_entities():
    analyzer = PresidioPIITagsExtractor()

    nlp_entities = {PIITag.NRP, PIITag.LOCATION, PIITag.PERSON}
    expected_recognized_entities = set(PIITag) - nlp_entities

    assert analyzer.get_recognized_entities() == expected_recognized_entities
    assert analyzer.get_unrecognized_entities() == nlp_entities


def test_presidio_pii_tag_extractor_extracts_global_pii_tags(fake):
    pii_extractor = PresidioPIITagsExtractor()

    # Exclude NRP, LOCATION, and PERSON as they are not recognized by our extractor
    entity_attr = {
        PIITag.CREDIT_CARD: [fake.credit_card_number],
        # PIITag.CRYPTO, cryptocurrency wallet addresses are currently not implemented in faker
        PIITag.DATE_TIME: [fake.date, fake.date_time],
        PIITag.EMAIL_ADDRESS: [fake.email],
        PIITag.IBAN_CODE: [fake.iban],
        PIITag.IP_ADDRESS: [fake.ipv4, fake.ipv6],
        PIITag.PHONE_NUMBER: [fake.phone_number],
        # PIITag.MEDICAL_LICENSE, medical license is not implemented in faker
        PIITag.URL: [fake.url],
    }

    for pii_tag, funcs in entity_attr.items():
        for func in funcs:
            samples = [str(func()) for _ in range(10)]
            extracted_pii_tags = pii_extractor.extract(samples)
            assert len(extracted_pii_tags) > 0, (pii_tag, samples)
            winner_pii_tag = max(extracted_pii_tags, key=extracted_pii_tags.get)
            assert winner_pii_tag == pii_tag, (pii_tag, samples, extracted_pii_tags)
