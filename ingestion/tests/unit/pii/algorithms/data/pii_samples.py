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
from typing import List, TypedDict

from metadata.generated.schema.entity.data.table import DataType
from metadata.pii.algorithms.tags import PIITag


class LabeledData(TypedDict):
    """Labeled data for testing"""

    column_name: str
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
