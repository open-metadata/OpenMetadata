#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
This script generates the Python models from the JSON Schemas definition. Additionally, it replaces the `SecretStr`
pydantic class used for the password fields with the `CustomSecretStr` pydantic class which retrieves the secrets
from a configured secrets' manager.
"""
import glob
import os
import re

from datamodel_code_generator.imports import Import
from datamodel_code_generator.model import pydantic as pydantic_model
from datamodel_code_generator.__main__ import main

pydantic_model.types.IMPORT_SECRET_STR = Import.from_full_path(
    "metadata.ingestion.models.custom_pydantic.CustomSecretStr"
)

current_directory = os.getcwd()
ingestion_path = "./" if current_directory.endswith("/ingestion") else "ingestion/"
directory_root = "../" if current_directory.endswith("/ingestion") else "./"

UTF_8 = "UTF-8"
UNICODE_REGEX_REPLACEMENT_FILE_PATHS = [
    f"{ingestion_path}src/metadata/generated/schema/entity/classification/tag.py",
    f"{ingestion_path}src/metadata/generated/schema/entity/events/webhook.py",
    f"{ingestion_path}src/metadata/generated/schema/entity/teams/user.py",
    f"{ingestion_path}src/metadata/generated/schema/entity/type.py",
    f"{ingestion_path}src/metadata/generated/schema/type/basic.py",
]

args = f"--input {directory_root}openmetadata-spec/src/main/resources/json/schema --output-model-type pydantic_v2.BaseModel --use-annotated --base-class metadata.ingestion.models.custom_pydantic.BaseModel --input-file-type jsonschema --output {ingestion_path}src/metadata/generated/schema --set-default-enum-member".split(" ")

main(args)

# Replace Unicode regex flags
for file_path in UNICODE_REGEX_REPLACEMENT_FILE_PATHS:
    with open(file_path, "r", encoding=UTF_8) as file_:
        content = file_.read()
        content = content.replace("(?U)", "(?u)")
    with open(file_path, "w", encoding=UTF_8) as file_:
        file_.write(content)

# Add missing Union import
MISSING_IMPORTS = [f"{ingestion_path}src/metadata/generated/schema/entity/applications/app.py",]
WRITE_AFTER = "from __future__ import annotations"

for file_path in MISSING_IMPORTS:
    with open(file_path, "r", encoding=UTF_8) as file_:
        lines = file_.readlines()
    with open(file_path, "w", encoding=UTF_8) as file_:
        for line in lines:
            file_.write(line)
            if line.strip() == WRITE_AFTER:
                file_.write("from typing import Union  # custom generate import\n\n")


# -------------------------------------------------------------------------
# REMOVE UNSUPPORTED REGEX PATTERN FROM ALL GENERATED FILES
# -------------------------------------------------------------------------
generated_files = glob.glob(f"{ingestion_path}src/metadata/generated/schema/**/*.py", recursive=True)

patterns_to_remove = [
    "pattern='^((?!::).)*$',",
    "pattern='^((?!::).)*$'",
    "pattern='^((?!::)[^><\"|\\\\x00-\\\\x1f])*$',",
    "pattern='^((?!::)[^><\"|\\\\x00-\\\\x1f])*$'",
    r"pattern='^((?!::)[^><\"|\\x00-\\x1f])*$',",
    r"pattern='^((?!::)[^><\"|\\x00-\\x1f])*$'",
]

for file_path in generated_files:
    with open(file_path, "r", encoding=UTF_8) as f:
        content = f.read()
    for pat in patterns_to_remove:
        content = content.replace(pat, "")
    with open(file_path, "w", encoding=UTF_8) as f:
        f.write(content)


def replace_class(content: str, class_name: str, new_class_def: str) -> str:
    """Find and replace a Pydantic RootModel class definition."""
    pattern = re.compile(
        r'class ' + re.escape(class_name) + r'\(RootModel\[str\]\):.*?(?=\nclass |\Z)',
        re.DOTALL
    )
    return pattern.sub(new_class_def, content)


# -------------------------------------------------------------------------
# INJECT CUSTOM VALIDATORS FOR SPECIFIC CLASSES
# -------------------------------------------------------------------------

# ---- basic.py: EntityName & TestCaseEntityName ----
BASIC_TYPE_FILE_PATH = f"{ingestion_path}src/metadata/generated/schema/type/basic.py"
with open(BASIC_TYPE_FILE_PATH, "r", encoding=UTF_8) as f:
    content = f.read()

# Add field_validator import if missing
if "from pydantic import" in content and "field_validator" not in content:
    content = content.replace(
        "from pydantic import AnyUrl, ConfigDict, EmailStr, Field, RootModel",
        "from pydantic import AnyUrl, ConfigDict, EmailStr, Field, RootModel, field_validator"
    )

entity_name_validator = '''

    @field_validator('root', mode='after')
    @classmethod
    def validate_entity_name(cls, value: str) -> str:
        """Validate entity name: disallow ::, special characters, and control characters."""
        if "::" in value:
            raise ValueError('Entity name cannot contain "::"')
        forbidden_chars = set('><"|') | set(chr(c) for c in range(0x20))
        if any(c in forbidden_chars for c in value):
            raise ValueError('Entity name contains invalid characters: ><"|, or control characters')
        return value
'''

test_case_entity_name_validator = '''

    @field_validator('root', mode='after')
    @classmethod
    def validate_test_case_entity_name(cls, value: str) -> str:
        """Validate test case entity name: disallow ::, special characters, and control characters."""
        if "::" in value:
            raise ValueError('Test case entity name cannot contain "::"')
        forbidden_chars = set('><"|') | set(chr(c) for c in range(0x20))
        if any(c in forbidden_chars for c in value):
            raise ValueError('Test case entity name contains invalid characters: ><"|, or control characters')
        return value
'''

if 'class EntityName(RootModel[str]):' in content and entity_name_validator not in content:
    content = content.replace(
        'class EntityName(RootModel[str]):\n    root: Annotated[\n        str,\n        Field(\n            description=\'Name that identifies an entity.\',\n            max_length=256,\n            min_length=1,\n        ),\n    ]',
        'class EntityName(RootModel[str]):\n    root: Annotated[\n        str,\n        Field(\n            description=\'Name that identifies an entity.\',\n            max_length=256,\n            min_length=1,\n        ),\n    ]' + entity_name_validator
    )

if 'class TestCaseEntityName(RootModel[str]):' in content and test_case_entity_name_validator not in content:
    content = content.replace(
        'class TestCaseEntityName(RootModel[str]):\n    root: Annotated[\n        str,\n        Field(\n            description=\'Name that identifies a test definition and test case.\',\n            min_length=1,\n        ),\n    ]',
        'class TestCaseEntityName(RootModel[str]):\n    root: Annotated[\n        str,\n        Field(\n            description=\'Name that identifies a test definition and test case.\',\n            min_length=1,\n        ),\n    ]' + test_case_entity_name_validator
    )

with open(BASIC_TYPE_FILE_PATH, "w", encoding=UTF_8) as f:
    f.write(content)


# ---- table.py: Column2 & ColumnName ----
TABLE_FILE_PATH = f"{ingestion_path}src/metadata/generated/schema/entity/data/table.py"
with open(TABLE_FILE_PATH, "r", encoding=UTF_8) as f:
    content = f.read()

if "from pydantic import" in content and "field_validator" not in content:
    def add_field_validator_import(match):
        imports = match.group(1)
        if 'field_validator' not in imports:
            if 'RootModel' in imports:
                parts = [p.strip() for p in imports.split(',')]
                for i, p in enumerate(parts):
                    if 'RootModel' in p:
                        parts.insert(i+1, 'field_validator')
                        break
                new_imports = ', '.join(parts)
            else:
                new_imports = imports + ', field_validator'
            return f'from pydantic import {new_imports}'
        return match.group(0)
    content = re.sub(r'from pydantic import (.*)', add_field_validator_import, content)

new_col2 = '''class Column2(RootModel[str]):
    root: str

    @field_validator('root', mode='after')
    @classmethod
    def validate_column2_name(cls, value: str) -> str:
        """Validate column2 name: disallow ::, special characters, and control characters."""
        if "::" in value:
            raise ValueError('Column2 name cannot contain "::"')
        forbidden_chars = set('><"|') | set(chr(c) for c in range(0x20))
        if any(c in forbidden_chars for c in value):
            raise ValueError('Column2 name contains invalid characters: ><"|, or control characters')
        return value
'''

new_colname = '''class ColumnName(RootModel[str]):
    root: Annotated[
        str,
        Field(
            description='Local name (not fully qualified name) of the column. ColumnName is `-` when the column is not named in struct dataType. For example, BigQuery supports struct with unnamed fields.',
            min_length=1,
        ),
    ]

    @field_validator('root', mode='after')
    @classmethod
    def validate_column_name(cls, value: str) -> str:
        """Validate column name: disallow ::, special characters, and control characters."""
        if "::" in value:
            raise ValueError('Column name cannot contain "::"')
        forbidden_chars = set('><"|') | set(chr(c) for c in range(0x20))
        if any(c in forbidden_chars for c in value):
            raise ValueError('Column name contains invalid characters: ><"|, or control characters')
        return value
'''

content = replace_class(content, 'Column2', new_col2)
content = replace_class(content, 'ColumnName', new_colname)

with open(TABLE_FILE_PATH, "w", encoding=UTF_8) as f:
    f.write(content)


# ---- schema.py: FieldName ----
SCHEMA_FILE_PATH = f"{ingestion_path}src/metadata/generated/schema/type/schema.py"
with open(SCHEMA_FILE_PATH, "r", encoding=UTF_8) as f:
    content = f.read()

if "from pydantic import" in content and "field_validator" not in content:
    def add_field_validator_import_schema(match):
        imports = match.group(1)
        if 'field_validator' not in imports:
            if 'RootModel' in imports:
                parts = [p.strip() for p in imports.split(',')]
                for i, p in enumerate(parts):
                    if 'RootModel' in p:
                        parts.insert(i+1, 'field_validator')
                        break
                new_imports = ', '.join(parts)
            else:
                new_imports = imports + ', field_validator'
            return f'from pydantic import {new_imports}'
        return match.group(0)
    content = re.sub(r'from pydantic import (.*)', add_field_validator_import_schema, content)

new_fieldname = '''class FieldName(RootModel[str]):
    root: str

    @field_validator('root', mode='after')
    @classmethod
    def validate_field_name(cls, value: str) -> str:
        """Validate field name: disallow ::, special characters, and control characters."""
        if "::" in value:
            raise ValueError('Field name cannot contain "::"')
        forbidden_chars = set('><"|') | set(chr(c) for c in range(0x20))
        if any(c in forbidden_chars for c in value):
            raise ValueError('Field name contains invalid characters: ><"|, or control characters')
        return value
'''

content = replace_class(content, 'FieldName', new_fieldname)

with open(SCHEMA_FILE_PATH, "w", encoding=UTF_8) as f:
    f.write(content)


# -------------------------------------------------------------------------
# DATETIME AWARE FIX (for basic.py)
# -------------------------------------------------------------------------
DATETIME_AWARE_FILE_PATHS = [
    f"{ingestion_path}src/metadata/generated/schema/type/basic.py",
]

for file_path in DATETIME_AWARE_FILE_PATHS:
    with open(file_path, "r", encoding=UTF_8) as f:
        content = f.read()
        content = content.replace(
            "from pydantic import AnyUrl, AwareDatetime, ConfigDict, EmailStr, Field, RootModel",
            "from pydantic import AnyUrl, ConfigDict, EmailStr, Field, RootModel"
        )
        content = content.replace("from datetime import date, time", "from datetime import date, time, datetime")
        content = content.replace("AwareDatetime", "datetime")
    with open(file_path, "w", encoding=UTF_8) as f:
        f.write(content)

print("Model generation and post-processing completed successfully.")