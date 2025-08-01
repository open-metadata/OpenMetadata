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
Simple data for testing.

In the future, we might want to use larger datasets to prevent regressions
of the classifiers. These datasets should then be stored in separate files in a format
like CSV, JSON or Parquet.
"""
from typing import List, Optional, TypedDict

from metadata.generated.schema.entity.data.table import DataType
from metadata.pii.algorithms.tags import PIITag


class LabeledData(TypedDict):
    """Labeled data for testing"""

    column_name: Optional[str]
    column_data_type: DataType
    sample_data: list[str]
    pii_tags: List[PIITag]
    pii_sensitivity: bool


email_data: LabeledData = {
    "column_name": "user_email",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "geraldc@gmail.com",
        "saratimithi@godesign.com",
        "heroldsean@google.com",
        "wrong input from user",
    ],
    "pii_tags": [PIITag.EMAIL_ADDRESS],
    "pii_sensitivity": True,
}

url_data: LabeledData = {
    "column_name": "user_url",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "https://www.example.com",
        "http://example.com",
        "https://example.com/path/to/resource",
        "https://example.com/path/to/resource?query=param",
    ],
    "pii_tags": [PIITag.URL],
    "pii_sensitivity": False,
}

phone_data: LabeledData = {
    "column_name": "user_phone",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "+1-202-555-0173",
        "+1-202-555-0174",
        "+1-202-555-0175",
        "+1-202-555-0176",
    ],
    "pii_tags": [PIITag.PHONE_NUMBER],
    "pii_sensitivity": True,
}

data_time_data: LabeledData = {
    "column_name": "event_time",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "2023-10-01 12:00:00Z",
        "2023-10-02 15:30:00Z",
        "2023-10-03 18:45:00Z",
        "2023-10-04 21:15:00Z",
    ],
    "pii_tags": [PIITag.DATE_TIME],
    "pii_sensitivity": False,
}

non_pii_text_data: LabeledData = {
    "column_name": "random_text",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "This is a random text without any PII.",
        "Another random text.",
        "Just some random words.",
    ],
    "pii_tags": [],
    "pii_sensitivity": False,
}

location_data: LabeledData = {
    "column_name": "user_location",
    "column_data_type": DataType.STRING,
    "sample_data": [
        "Washington",
        "Alaska",
        "Netherfield Lea Street",
    ],
    "pii_tags": [PIITag.LOCATION],
    "pii_sensitivity": True,
}

json_data = {
    "column_name": "user_info",
    "column_data_type": DataType.STRING,
    "sample_data": [
        '{"email": "johndoe@example.com", "address": {"street": "123 Main Street, Anytown, USA"}}',
        '{"email": "potato", "age": 30, "preferences": {"newsletter": true, "notifications": "email"}}',
    ],
    "pii_tags": [PIITag.EMAIL_ADDRESS, PIITag.LOCATION],
    "pii_sensitivity": True,
}

json_no_pii_data = {
    "column_name": "user_info",
    "column_data_type": DataType.STRING,
    "sample_data": [
        '{"email": "foo", "address": {"street": "bar"}}',
        '{"email": "potato", "age": 30, "preferences": {"newsletter": true, "notifications": "email"}}',
    ],
    "pii_tags": [],
    "pii_sensitivity": False,
}

# Valid aadhaar numbers
indian_aadhaar_data: LabeledData = {
    "column_name": None,
    "column_data_type": DataType.STRING,
    "sample_data": [
        "466299546357",
        "967638147560",
        "988307845186",
        "6622-2350-9284",
        "2161 6729 3627",
        "8384-2795-9970",
        "6213-3631-4249",
        "1667-9750-5883",
        "0249-3285-1294",
    ],
    "pii_tags": [PIITag.IN_AADHAAR],
    "pii_sensitivity": True,
}

indian_pan_data: LabeledData = {
    "column_name": None,
    "column_data_type": DataType.STRING,
    "sample_data": [
        "AFZPK7190K",
        "BLQSM2938L",
        "CWRTJ5821M",
        "DZXNV9045A",
        "EHYKG6752P",
    ],
    "pii_tags": [PIITag.IN_PAN],
    "pii_sensitivity": True,
}

us_ssn_data: LabeledData = {
    "column_name": None,
    "column_data_type": DataType.STRING,
    "sample_data": [
        "211-61-2524",
        "123-45-6789",
        "987-65-4321",
        "543-21-0987",
        "678-90-1234",
        "876-54-3210",
    ],
    "pii_tags": [PIITag.US_SSN],
    "pii_sensitivity": True,
}

# ES NIF are correctly tagged with score of 1, other entities
# DATE_TIME, US_DRIVER_LICENSE are also tagged with score < 0.5
# TODO: Add a new field to the LabeledData to specify the winner tag
es_nif_data: LabeledData = {
    "column_name": None,  # Otherwise it will be confused with a phone number
    "column_data_type": DataType.STRING,
    "sample_data": ["48347544A", "08163649Y", "85738706L", "01922869T", "44729355J"],
    "pii_tags": [
        PIITag.ES_NIF,
        PIITag.US_DRIVER_LICENSE,  # low score
    ],
    "pii_sensitivity": True,
}

# Sample data for regression tests

# Previously, this data was incorrectly tagged as PII.DATE_TIME
false_positive_datetime_data: LabeledData = {
    "column_name": None,
    "column_data_type": DataType.STRING,
    "sample_data": [
        "60001",
        "60002",
        "60003",
        "60004",
        "60005",
        "60006",
        "60007",
    ],
    "pii_tags": [],
    "pii_sensitivity": False,
}
