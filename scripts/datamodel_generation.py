import datamodel_code_generator.model.pydantic
from datamodel_code_generator.imports import Import

UNICODE_REGEX_REPLACEMENT_FILE_PATHS = [
    "ingestion/src/metadata/generated/schema/entity/classification/tag.py",
    "ingestion/src/metadata/generated/schema/entity/events/webhook.py",
    "ingestion/src/metadata/generated/schema/entity/teams/user.py",
    "ingestion/src/metadata/generated/schema/entity/type.py",
    "ingestion/src/metadata/generated/schema/type/basic.py",
]

datamodel_code_generator.model.pydantic.types.IMPORT_SECRET_STR = Import.from_full_path(
    "metadata.ingestion.models.custom_pydantic.CustomSecretStr"
)

from datamodel_code_generator.__main__ import main

args = "--input openmetadata-spec/src/main/resources/json/schema --input-file-type jsonschema --output ingestion/src/metadata/generated/schema --set-default-enum-member".split(
    " "
)
main(args)

for file_path in UNICODE_REGEX_REPLACEMENT_FILE_PATHS:
    with open(file_path, "r", encoding="UTF-8") as file_:
        content = file_.read()
        content = content.replace("(?U)", "(?u)")
    with open(file_path, "w", encoding="UTF-8") as file_:
        file_.write(content)
