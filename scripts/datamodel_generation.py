import datamodel_code_generator.model.pydantic
from datamodel_code_generator.imports import Import

datamodel_code_generator.model.pydantic.types.IMPORT_SECRET_STR = Import.from_full_path(
    "metadata.ingestion.models.custom_pydantic.CustomSecretStr"
)

from datamodel_code_generator.__main__ import main

args = "--input openmetadata-spec/src/main/resources/json/schema --input-file-type jsonschema --output ingestion/src/metadata/generated/schema --set-default-enum-member".split(
    " "
)
main(args)
