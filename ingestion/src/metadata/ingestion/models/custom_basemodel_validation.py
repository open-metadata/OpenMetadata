#  Copyright 2022 Collate
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
Validation logic for Custom Pydantic BaseModel
"""

import logging

logger = logging.getLogger("metadata")


RESTRICTED_KEYWORDS = ["::", ">"]
RESERVED_COLON_KEYWORD = "__reserved__colon__"
RESERVED_ARROW_KEYWORD = "__reserved__arrow__"
RESERVED_QUOTE_KEYWORD = "__reserved__quote__"

CREATE_ADJACENT_MODELS = {"ProfilerResponse", "SampleData"}
NAME_FIELDS = {"EntityName", "str", "ColumnName", "TableData"}
FETCH_MODELS = {"Table", "CustomColumnName", "DashboardDataModel"}
FIELD_NAMES = {"name", "columns", "root"}


def revert_separators(value):
    return (
        value.replace(RESERVED_COLON_KEYWORD, "::")
        .replace(RESERVED_ARROW_KEYWORD, ">")
        .replace(RESERVED_QUOTE_KEYWORD, '"')
    )


def replace_separators(value):
    return (
        value.replace("::", RESERVED_COLON_KEYWORD)
        .replace(">", RESERVED_ARROW_KEYWORD)
        .replace('"', RESERVED_QUOTE_KEYWORD)
    )


def validate_name_and_transform(values, modification_method, field_name: str = None):
    """
    Validate the name and transform it if needed.
    """
    if isinstance(values, str) and field_name in FIELD_NAMES:
        values = modification_method(values)
    elif (
        hasattr(values, "root")
        and isinstance(values.root, str)
        and field_name in FIELD_NAMES
    ):
        values.root = modification_method(values.root)
    elif hasattr(values, "model_fields"):
        for key in type(values).model_fields.keys():
            if getattr(values, key):
                if getattr(values, key).__class__.__name__ in NAME_FIELDS:
                    setattr(
                        values,
                        key,
                        validate_name_and_transform(
                            getattr(values, key),
                            modification_method=modification_method,
                            field_name=key,
                        ),
                    )
                elif isinstance(getattr(values, key), list):
                    setattr(
                        values,
                        key,
                        [
                            validate_name_and_transform(
                                item,
                                modification_method=modification_method,
                                field_name=key,
                            )
                            for item in getattr(values, key)
                        ],
                    )
    return values
