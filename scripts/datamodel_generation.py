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
import warnings

from datamodel_code_generator.imports import Import
# `model.pydantic` held the Pydantic v1 models and was removed in datamodel-code-generator 0.60+.
# We generate with `--output-model-type pydantic_v2.BaseModel`, so patch the v2 type map.
from datamodel_code_generator.model import pydantic_v2 as pydantic_model
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

# OpenMetadata uses `format` as its own vocabulary rather than only the JSON Schema standard one:
# the UI form builder picks a widget from it (`FormBuilder.tsx` maps "queryBuilder" to
# QueryBuilderWidget, "password" to a masked input), and the rest are semantic hints for readers and
# for the Java/TS generators. datamodel-code-generator only knows the standard formats, so it warns
# and falls back to the base type -- which is exactly the behaviour we want here.
#
# Silence only the vocabulary we own, so a genuinely new or misspelled format still surfaces.
# Changing these in the schemas is NOT a safe cleanup: `format` drives UI widget selection.
KNOWN_CUSTOM_FORMATS = (
    "int64",
    "json",
    "queryBuilder",
    "string",
    "timezone",
    "URI",
    "url",
    "utc-millisec",
)
warnings.filterwarnings(
    "ignore",
    message=rf"format of '(?:{'|'.join(map(re.escape, KNOWN_CUSTOM_FORMATS))})' not understood",
    category=UserWarning,
)

# `--formatters` is passed explicitly because the external formatters (black, isort) are about to
# become opt-in upstream. Naming them keeps today's output shape, which the post-processing below
# depends on: SOURCE_CONFIG_BLOCK matches black's parenthesised-annotation layout.
args = f"--input {directory_root}openmetadata-spec/src/main/resources/json/schema --output-model-type pydantic_v2.BaseModel --use-annotated --base-class metadata.ingestion.models.custom_pydantic.BaseModel --input-file-type jsonschema --output {ingestion_path}src/metadata/generated/schema --set-default-enum-member --formatters black isort".split(" ")

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


# -------------------------------------------------------------------------
# PIN UNION RESOLUTION FOR SourceConfig.config
# -------------------------------------------------------------------------
# `sourceConfig.config` is an undiscriminated `oneOf`: every member declares a
# `type` with a JSON Schema default and none of them list it as required, so a
# config that omits `type` validates against several members at once and pydantic
# has to break the tie itself. Under datamodel-code-generator 0.25.6 smart mode
# resolved to the leftmost match (DatabaseServiceMetadataPipeline); under 0.64.0
# it resolves to DatabaseServiceProfilerPipeline, so a metadata workflow silently
# receives a profiler config and then dies on `source_config.threads`.
# `left_to_right` restores the previous winner.
#
# This is a stopgap for the Python models only. The real fix is a discriminator on
# `type` in openmetadata-spec/.../metadataIngestion/workflow.json, which would
# resolve the union deterministically for the Java and TypeScript consumers too.
UNION_MODE_FILE = f"{ingestion_path}src/metadata/generated/schema/metadataIngestion/workflow.py"
# black may wrap the long union annotation (older layout: `config: (\n ... \n    ) = None`)
# or the default value (newer layout: `config: ... | None = (\n        None\n    )`). Handle both
# so a black formatting change does not silently drop the union_mode pin.
SOURCE_CONFIG_BLOCKS = (
    re.compile(r"(class SourceConfig\(BaseModel\):.*?\n    \) )= None\n", re.DOTALL),
    re.compile(r"(class SourceConfig\(BaseModel\):.*?\| None )= \(\s*None\s*\)\n", re.DOTALL),
)

with open(UNION_MODE_FILE, "r", encoding=UTF_8) as f:
    content = f.read()

applied = 0
for source_config_block in SOURCE_CONFIG_BLOCKS:
    content, applied = source_config_block.subn(
        r'\1= Field(None, union_mode="left_to_right")\n', content, count=1
    )
    if applied == 1:
        break
if applied != 1:
    # Fail loudly: silently skipping this leaves every `type`-less workflow config
    # resolving to the wrong pipeline model at runtime.
    raise RuntimeError(
        f"Could not pin union_mode on SourceConfig.config in {UNION_MODE_FILE}. "
        "The generated layout changed -- update SOURCE_CONFIG_BLOCK."
    )

with open(UNION_MODE_FILE, "w", encoding=UTF_8) as f:
    f.write(content)

print("Model generation and post-processing completed successfully.")
