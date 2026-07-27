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
# pydantic-core's regex engine does not support the negative-lookahead
# pattern used in the JSON Schema (`(?!::)...`) that blocks reserved FQN
# separator characters. The actual enforcement of that rule lives in the
# JSON Schema itself (validated server-side by the Java backend) and in
# metadata.ingestion.models.custom_basemodel_validation.transform_entity_names,
# which deliberately allows these characters through the Python model layer
# so it can encode them (e.g. "::" -> "__reserved__colon__") on Create/Store
# models and decode them back on Fetch models. Do NOT add a client-side
# Pydantic field_validator here that rejects these characters at
# construction time -- that would make it impossible to ever construct the
# raw-named object that transform_entity_names is meant to encode, breaking
# tests in tests/unit/models/test_custom_basemodel_validation.py.
generated_files = glob.glob(f"{ingestion_path}src/metadata/generated/schema/**/*.py", recursive=True)

patterns_to_remove = [
    "pattern='^((?!::).)*$',",
    "pattern='^((?!::).)*$'",
    "pattern='^((?!::)[^>\"\\\\x00-\\\\x1f])*$',",
    "pattern='^((?!::)[^>\"\\\\x00-\\\\x1f])*$'",
    r"pattern='^((?!::)[^>\"\\x00-\\x1f])*$',",
    r"pattern='^((?!::)[^>\"\\x00-\\x1f])*$'",
]

for file_path in generated_files:
    with open(file_path, "r", encoding=UTF_8) as f:
        content = f.read()
    for pat in patterns_to_remove:
        content = content.replace(pat, "")
    with open(file_path, "w", encoding=UTF_8) as f:
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
