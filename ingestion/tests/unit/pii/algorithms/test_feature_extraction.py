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
from typing import Mapping, Optional

from metadata.pii.algorithms.column_patterns import get_pii_column_name_patterns
from metadata.pii.algorithms.feature_extraction import (
    extract_pii_from_column_names,
    extract_pii_tags,
    split_column_name,
)
from metadata.pii.algorithms.presidio_patches import date_time_patcher, url_patcher
from metadata.pii.algorithms.tags import PIITag


def get_top_pii_tag(extracted: Mapping[PIITag, float]) -> Optional[PIITag]:
    return max(extracted, key=extracted.get, default=None)


# Test cases for non-country specific PII tags


def test_credit_card_extraction(fake, analyzer):
    samples = [fake.credit_card_number() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.CREDIT_CARD, (
        PIITag.CREDIT_CARD,
        samples,
        extracted,
    )


def test_date_time_extraction_with_date(fake, analyzer):
    samples = [str(fake.date()) for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.DATE_TIME, (
        PIITag.DATE_TIME,
        samples,
        extracted,
    )


def test_date_time_extraction_with_datetime(fake, analyzer):
    samples = [str(fake.date_time()) for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.DATE_TIME, (
        PIITag.DATE_TIME,
        samples,
        extracted,
    )


def test_email_address_extraction(fake, analyzer):
    samples = [fake.email() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.EMAIL_ADDRESS, (
        PIITag.EMAIL_ADDRESS,
        samples,
        extracted,
    )


def test_iban_code_extraction(fake, analyzer):
    samples = [fake.iban() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.IBAN_CODE, (
        PIITag.IBAN_CODE,
        samples,
        extracted,
    )


def test_ip_address_extraction_with_ipv4(fake, analyzer):
    samples = [fake.ipv4() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.IP_ADDRESS, (
        PIITag.IP_ADDRESS,
        samples,
        extracted,
    )


def test_ip_address_extraction_with_ipv6(fake, analyzer):
    samples = [fake.ipv6() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.IP_ADDRESS, (
        PIITag.IP_ADDRESS,
        samples,
        extracted,
    )


def test_phone_number_extraction(fake, analyzer):
    samples = [fake.phone_number() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.PHONE_NUMBER, (
        PIITag.PHONE_NUMBER,
        samples,
        extracted,
    )


def test_url_extraction(fake, analyzer):
    samples = [fake.url() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.URL, (PIITag.URL, samples, extracted)


def test_location_extraction(fake, analyzer):
    samples = [fake.country() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.LOCATION, (
        PIITag.LOCATION,
        samples,
        extracted,
    )


def test_person_extraction(fake, analyzer):
    samples = [fake.name() for _ in range(100)]
    extracted = extract_pii_tags(analyzer, samples)
    assert get_top_pii_tag(extracted) == PIITag.PERSON, (
        PIITag.PERSON,
        samples,
        extracted,
    )


def test_date_time_extraction_false_positive_regression(fake, analyzer):
    """
    Regression test for a false positive where a timestamp was incorrectly
    marked as a date by the Presidio analyzer.
    """
    not_dates = [60001, 60002, 60003, 60004, 60005]
    not_dates_str = [str(date) for date in not_dates]
    extracted = extract_pii_tags(
        analyzer, not_dates_str, recognizer_result_patcher=date_time_patcher
    )
    assert PIITag.DATE_TIME not in extracted


def test_date_time_extraction_with_patched_results(fake, analyzer):
    # Generate a list of dates and times
    samples = [str(fake.date_time_this_century()) for _ in range(100)]
    # Patch the results to avoid false positives
    extracted = extract_pii_tags(
        analyzer, samples, recognizer_result_patcher=date_time_patcher
    )

    assert PIITag.DATE_TIME in extracted


# Extraction with patched URL
def test_email_address_extraction_does_not_extract_url(fake, analyzer):
    samples = [fake.email() for _ in range(100)]
    # Patch the URL to avoid false positives
    extracted = extract_pii_tags(
        analyzer, samples, recognizer_result_patcher=url_patcher
    )
    extracted_tags = set(extracted)

    assert (
        PIITag.EMAIL_ADDRESS in extracted_tags and PIITag.URL not in extracted_tags
    ), (
        PIITag.EMAIL_ADDRESS,
        samples,
        extracted,
    )


# USA-specific PII tags


def test_us_driver_license_extraction(fake_en_us, analyzer):
    # We need more samples to remove false positives
    samples = [fake_en_us.license_plate() for _ in range(100)]
    context = ["license", "driver"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.US_DRIVER_LICENSE, (
        PIITag.US_DRIVER_LICENSE,
        samples,
        extracted,
    )


def test_us_itin_extraction(fake_en_us, analyzer):
    samples = [fake_en_us.itin() for _ in range(100)]
    context = ["itin"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.US_ITIN, (
        PIITag.US_ITIN,
        samples,
        extracted,
    )


def test_us_passport_extraction(fake_en_us, analyzer):
    samples = [fake_en_us.passport_number() for _ in range(100)]
    context = ["passport", "document"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.US_PASSPORT, (
        PIITag.US_PASSPORT,
        samples,
        extracted,
    )


def test_us_ssn_extraction(fake_en_us, analyzer):
    samples = [fake_en_us.ssn() for _ in range(100)]
    context = ["ssn"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.US_SSN, (
        PIITag.US_SSN,
        samples,
        extracted,
    )


# Indian specific PII tags
def test_aadhaar_extraction(analyzer):
    # fake = local_fake_factory("en_IN")  # Use Indian locale
    # samples = [fake.aadhaar_id() for _ in range(100)]
    # Unfortunately, the generated aadhaar_ids by Faker are not always valid
    samples = [
        "466299546357",
        "967638147560",
        "988307845186",
        "6622-2350-9284",
        "2161 6729 3627",
        "8384-2795-9970",
        "6213-3631-4249",
        "1667-9750-5883",
        "0249-3285-1294",
    ]
    context = ["aadhaar", "govt id", "uidai"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.IN_AADHAAR, (
        PIITag.IN_AADHAAR,
        samples,
        extracted,
    )


def test_indian_passport_extraction(analyzer):
    # Randomly generated valid Indian passport numbers
    samples = [
        "A1234567",
        "B7654321",
        "C2345678",
        "D3456789",
        "E4567890",
        "F5678901",
        "G6789012",
        "H7890123",
        "J8901234",
        "K9012345",
    ]

    context = ["passport", "document"]
    extracted = extract_pii_tags(analyzer, samples, context=context)
    assert get_top_pii_tag(extracted) == PIITag.IN_PASSPORT, (
        PIITag.IN_PASSPORT,
        samples,
        extracted,
    )


def test_extract_pii_from_column_names():
    """
    Test the extract_pii_from_column_names function with various column names.
    """

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

    patterns = get_pii_column_name_patterns()

    for pii_tag, column_names in pii_tag_to_column_names.items():
        for column_name in column_names:
            extracted_pii_tags = extract_pii_from_column_names(column_name, patterns)
            assert pii_tag in extracted_pii_tags, (pii_tag, column_name)


def test_split_column_name():
    """
    Test the split_column_name function with various column names.
    """

    column_names_split = [
        ("user_id", ["user", "id"]),
        ("user-name", ["user", "name"]),
        ("user name", ["user", "name"]),
        ("user.name", ["user", "name"]),
        ("user/name", ["user", "name"]),
        ("user-id", ["user", "id"]),
        ("user-id-123", ["user", "id", "123"]),
        ("user_id_123", ["user", "id", "123"]),
    ]

    for column_name, components in column_names_split:
        assert components == split_column_name(column_name), column_name
