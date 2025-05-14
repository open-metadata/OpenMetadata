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

from metadata.pii.feature_extraction import (
    extract_pii_from_column_names,
    extract_pii_tags,
    pii_column_name_patterns,
)
from metadata.pii.presidio_utils import build_analyzer_engine, set_presidio_logger_level
from metadata.pii.tags import PIITag


def test_presidio_pii_tag_extractor_extracts_global_pii_tags(fake):
    """
    Test PresidioPIITagsExtractor with global PII tags and no further context
    provided to the extractor.
    """
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()

    # MEDICAL_LICENSE and CRYPTO are excluded as they are not implemented in faker
    # NRP is excluded as it not clear what to use for it
    entity_attr = {
        PIITag.CREDIT_CARD: [fake.credit_card_number],
        PIITag.DATE_TIME: [fake.date, fake.date_time],
        PIITag.EMAIL_ADDRESS: [fake.email],
        PIITag.IBAN_CODE: [fake.iban],
        PIITag.IP_ADDRESS: [fake.ipv4, fake.ipv6],
        PIITag.PHONE_NUMBER: [fake.phone_number],
        PIITag.URL: [fake.url],
        PIITag.LOCATION: [fake.country],
        PIITag.PERSON: [fake.name],
    }

    for pii_tag, funcs in entity_attr.items():
        for func in funcs:
            samples = [str(func()) for _ in range(10)]
            extracted_pii_tags = extract_pii_tags(analyzer, samples)
            assert len(extracted_pii_tags) > 0, (pii_tag, samples)
            winner_pii_tag = max(extracted_pii_tags, key=extracted_pii_tags.get)
            assert winner_pii_tag == pii_tag, (pii_tag, samples, extracted_pii_tags)


def test_presidio_pii_tag_extractor_extracts_usa_pii_tags(local_fake_factory):

    fake = local_fake_factory("en_US")
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()

    entity_attr = {
        # PIITag.US_BANK_NUMBER: [fake.us_],
        PIITag.US_DRIVER_LICENSE: [fake.license_plate],
        PIITag.US_ITIN: [fake.itin],
        PIITag.US_PASSPORT: [fake.passport_number],
        PIITag.US_SSN: [fake.ssn],
    }

    # To recognize any of the following PII tags, we need to provide context,
    # otherwise they are confused with other tags: SSN, PASSPORT, ITIN are all
    # 9-digit numbers with
    entity_context = {
        PIITag.US_DRIVER_LICENSE: ["license", "document"],
        PIITag.US_PASSPORT: ["passport", "document"],
        PIITag.US_SSN: ["ssn"],
        PIITag.US_ITIN: ["itin"],
    }

    for pii_tag, funcs in entity_attr.items():
        context = entity_context.get(pii_tag, [])
        for func in funcs:
            samples = [str(func()) for _ in range(10)]
            extracted_pii_tags = extract_pii_tags(
                analyzer,
                samples,
                context=context,
            )
            assert len(extracted_pii_tags) > 0, (pii_tag, samples)
            winner_pii_tag = max(extracted_pii_tags, key=extracted_pii_tags.get)
            assert winner_pii_tag == pii_tag, (pii_tag, samples, extracted_pii_tags)


def test_extract_pii_from_column_names():
    """
    Test the extract_pii_from_column_names function with various column names.
    """
    patterns = pii_column_name_patterns()

    pii_tag_to_column_names = {
        PIITag.US_BANK_NUMBER: ["bank_account", "bank_number", "account_number"],
        PIITag.IBAN_CODE: [
            "iban",
            "iban_code",
            "international_bank_number",
            "bank_account",
            "bank_number",
            "account_number",
        ],
        PIITag.CREDIT_CARD: [
            "credit_card",
            "credit_card_number",
            "personal_credit_card",
        ],
        PIITag.US_SSN: ["ssn", "social_security_number", "social_security"],
        PIITag.EMAIL_ADDRESS: ["email", "e-mail", "mail_address"],
        PIITag.PERSON: ["user_name", "client_name", "first_name", "last_name"],
        PIITag.DATE_TIME: ["date_of_birth", "dob", "birthday"],
    }

    for pii_tag, column_names in pii_tag_to_column_names.items():
        for column_name in column_names:
            extracted_pii_tags = extract_pii_from_column_names(patterns, column_name)
            assert pii_tag in extracted_pii_tags, (pii_tag, column_name)
