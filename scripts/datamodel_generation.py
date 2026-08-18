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
import os
import re


pydantic_model.types.IMPORT_SECRET_STR = Import.from_full_path(
    "metadata.ingestion.models.custom_pydantic.CustomSecretStr"
)

from datamodel_code_generator.__main__ import main

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

for file_path in UNICODE_REGEX_REPLACEMENT_FILE_PATHS:
    with open(file_path, "r", encoding=UTF_8) as file_:
        content = file_.read()
        # Python now requires to move the global flags at the very start of the expression
        content = content.replace("(?U)", "(?u)")
    with open(file_path, "w", encoding=UTF_8) as file_:
        file_.write(content)

# Until https://github.com/koxudaxi/datamodel-code-generator/issues/1895
# TODO: This has been merged but `Union` is still not there. We'll need to validate
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


# unsupported rust regex pattern for pydantic v2
# https://docs.pydantic.dev/2.7/api/config/#pydantic.config.ConfigDict.regex_engine
# We'll remove validation from the client and let it fail on the server, rather than on the model generation
UNSUPPORTED_REGEX_PATTERN_FILE_PATHS = [
    f"{ingestion_path}src/metadata/generated/schema/type/basic.py",
    f"{ingestion_path}src/metadata/generated/schema/entity/data/searchIndex.py",
    f"{ingestion_path}src/metadata/generated/schema/entity/data/table.py",
]

for file_path in UNSUPPORTED_REGEX_PATTERN_FILE_PATHS:
    with open(file_path, "r", encoding=UTF_8) as file_:
        content = file_.read()
        content = content.replace("pattern='^((?!::).)*$',", "")
    with open(file_path, "w", encoding=UTF_8) as file_:
        file_.write(content)

# Until https://github.com/koxudaxi/datamodel-code-generator/issues/1996
# Supporting timezone aware datetime is too complex for the profiler
DATETIME_AWARE_FILE_PATHS = [
    f"{ingestion_path}src/metadata/generated/schema/type/basic.py",
]

for file_path in DATETIME_AWARE_FILE_PATHS:
    with open(file_path, "r", encoding=UTF_8) as file_:
        content = file_.read()
        content = content.replace(
            "from pydantic import AnyUrl, AwareDatetime, ConfigDict, EmailStr, Field, RootModel",
            "from pydantic import AnyUrl, ConfigDict, EmailStr, Field, RootModel"
        )
        content = content.replace("from datetime import date, time", "from datetime import date, time, datetime")
        content = content.replace("AwareDatetime", "datetime")
    with open(file_path, "w", encoding=UTF_8) as file_:
        file_.write(content)


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
# datamodel-code-generator formats its output with whatever black the environment
# resolves (it only requires black>=19.10b0), and black renders this annotation two
# different ways depending on its version. 23.x+ parenthesizes the annotation; 22.3.0
# cannot split it, so it leaves the annotation on one line and wraps the value instead:
#   black >= 23.x    ->  config: (\n        A\n        | B\n    ) = None
#   black == 22.3.0  ->  config: A | B | None = None
#                    ->  config: A | B | None = (\n        None\n    )   # very long lines
# 1.13 pins black==22.3.0 while main uses ruff and resolves the latest black, so the
# pattern has to accept both. The `(?!\nclass )` guards keep the match inside
# SourceConfig, so a genuinely new layout still fails loudly below instead of
# silently pinning union_mode on some other class's `config` field.
SOURCE_CONFIG_BLOCK = re.compile(
    r"(class SourceConfig\(BaseModel\):(?:(?!\nclass ).)*?\n    config: (?:(?!\nclass ).)*?)"
    r"= (?:None|\(\s*None\s*\))\n",
    re.DOTALL,
)

with open(UNION_MODE_FILE, "r", encoding=UTF_8) as f:
    content = f.read()

content, applied = SOURCE_CONFIG_BLOCK.subn(r'\1= Field(None, union_mode="left_to_right")\n', content, count=1)
if applied != 1:
    # Fail loudly: silently skipping this leaves every `type`-less workflow config
    # resolving to the wrong pipeline model at runtime.
    raise RuntimeError(
        f"Could not pin union_mode on SourceConfig.config in {UNION_MODE_FILE}. "
        "The generated layout changed -- update SOURCE_CONFIG_BLOCK."
    )

with open(UNION_MODE_FILE, "w", encoding=UTF_8) as f:
    f.write(content)
