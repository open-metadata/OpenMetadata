#  Copyright 2022 Collate
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
Pydantic classes overwritten defaults ones of code generation.

This classes are used in the generated module, which should have NO
dependencies against any other metadata package. This class should
be self-sufficient with only pydantic at import time.
"""
import json
import logging
from typing import Any, Dict, Literal, Optional, Union

from pydantic import BaseModel as PydanticBaseModel
from pydantic import PlainSerializer, model_validator
from pydantic.main import IncEx
from pydantic.types import SecretStr
from typing_extensions import Annotated

logger = logging.getLogger("metadata")

SECRET = "secret:"
JSON_ENCODERS = "json_encoders"

RESTRICTED_KEYWORDS = ["::", ">"]
RESERVED_COLON_KEYWORD = "__reserved__colon__"
RESERVED_ARROW_KEYWORD = "__reserved__arrow__"


class BaseModel(PydanticBaseModel):
    """
    Base model for OpenMetadata generated models.
    Specified as `--base-class BASE_CLASS` in the generator.
    """

    @model_validator(mode="after")
    @classmethod
    def parse_name(cls, values):
        """
        Parse the name field to ensure it is not empty.
        """

        def process_name_and_display_name(
            obj: Union["CreateTableRequest", "Column", "Table"]
        ) -> None:
            name_value: Optional[str] = obj.name.root
            if (
                name_value
                and RESERVED_COLON_KEYWORD in name_value
                or RESERVED_ARROW_KEYWORD in name_value
            ):
                obj.name.root = revert_separators(value=name_value)
                # if hasattr(obj, "fullyQualifiedName"):
                # obj.fullyQualifiedName.root = revert_separators(obj.fullyQualifiedName.root)
                return
            if name_value and "::" in name_value:
                obj.name.root = replace_separators(name_value)
                if not obj.displayName:
                    obj.displayName = name_value
                return
            return

        def revert_separators(value):
            return value.replace(RESERVED_COLON_KEYWORD, "::").replace(
                RESERVED_ARROW_KEYWORD, ">"
            )

        def replace_separators(value):
            return value.replace("::", RESERVED_COLON_KEYWORD).replace(
                ">", RESERVED_ARROW_KEYWORD
            )

        def process_table_and_columns(values):
            # Table Level
            process_name_and_display_name(values)
            # Column level
            columns = values.columns
            if columns:
                for column in columns:
                    process_name_and_display_name(column)

        from metadata.generated.schema.api.data.createTable import CreateTableRequest
        from metadata.generated.schema.entity.data.table import Column, Table
        from metadata.profiler.source.metadata import ProfilerSourceAndEntity

        if values:
            if isinstance(values, (CreateTableRequest, Table)):
                process_table_and_columns(values)
            if isinstance(values, Column):
                process_name_and_display_name(values)
            if isinstance(values, ProfilerSourceAndEntity):
                process_table_and_columns(values.entity)

            # # Constraint Level
            # table_constraints: Optional[List[Dict[str, Any]]] = values.get(
            #     "tableConstraints"
            # )
            # if table_constraints:
            #     for constraint in table_constraints:
            #         constraint_columns: Optional[List[str]] = constraint.get("columns")
            #         if constraint_columns:
            #             for index, constraint_column in enumerate(constraint_columns):
            #                 if "::" in constraint_column:
            #                     constraint_columns[index] = replace_separators(
            #                         constraint_column
            #                     )

        return values

    def model_dump_json(  # pylint: disable=too-many-arguments
        self,
        *,
        indent: Optional[int] = None,
        include: IncEx = None,
        exclude: IncEx = None,
        context: Optional[Dict[str, Any]] = None,
        by_alias: bool = False,
        exclude_unset: bool = True,
        exclude_defaults: bool = False,
        exclude_none: bool = True,
        round_trip: bool = False,
        warnings: Union[bool, Literal["none", "warn", "error"]] = True,
        serialize_as_any: bool = False,
    ) -> str:
        """
        This is needed due to https://github.com/pydantic/pydantic/issues/8825

        We also tried the suggested `serialize` method but it did not
        work well with nested models.

        This solution is covered in the `test_pydantic_v2` test comparing the
        dump results from V1 vs. V2.
        """
        return json.dumps(
            self.model_dump(
                mode="json",
                include=include,
                exclude=exclude,
                context=context,
                by_alias=by_alias,
                exclude_unset=exclude_unset,
                exclude_none=exclude_none,
                exclude_defaults=exclude_defaults,
                round_trip=round_trip,
                warnings=warnings,
                serialize_as_any=serialize_as_any,
            ),
            ensure_ascii=True,
        )


class _CustomSecretStr(SecretStr):
    """
    Custom SecretStr class which use the configured Secrets Manager to retrieve the actual values.

    If the secret string value starts with `config:` it will use the rest of the string as secret id to search for it
    in the secrets store.
    """

    def __repr__(self) -> str:
        return f"SecretStr('{self}')"

    def get_secret_value(self, skip_secret_manager: bool = False) -> str:
        """
        This function should only be called after the SecretsManager has properly
        been initialized (e.g., after instantiating the ometa client).

        Since the SecretsManagerFactory is a singleton, getting it here
        will pick up the object with all the necessary info already in it.
        """
        # Importing inside function to avoid circular import error
        from metadata.utils.secrets.secrets_manager_factory import (  # pylint: disable=import-outside-toplevel,cyclic-import
            SecretsManagerFactory,
        )

        if (
            not skip_secret_manager
            and self._secret_value.startswith(SECRET)
            and SecretsManagerFactory().get_secrets_manager()
        ):
            secret_id = self._secret_value.replace(SECRET, "")
            try:
                return (
                    SecretsManagerFactory()
                    .get_secrets_manager()
                    .get_string_value(secret_id)
                )
            except Exception as exc:
                logger.error(
                    f"Secret value [{secret_id}] not present in the configured secrets manager: {exc}"
                )
        return self._secret_value


CustomSecretStr = Annotated[
    _CustomSecretStr, PlainSerializer(lambda secret: secret.get_secret_value())
]


def ignore_type_decoder(type_: Any) -> None:
    """Given a type_, add a custom decoder to the BaseModel
    to ignore any decoding errors for that type_."""
    # We don't import the constants from the constants module to avoid circular imports
    BaseModel.model_config[JSON_ENCODERS][type_] = {
        lambda v: v.decode("utf-8", "ignore")
    }
