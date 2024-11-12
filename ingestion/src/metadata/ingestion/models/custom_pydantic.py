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
# pylint: disable=import-outside-toplevel
"""
Pydantic classes overwritten defaults ones of code generation.

This classes are used in the generated module, which should have NO
dependencies against any other metadata package. This class should
be self-sufficient with only pydantic at import time.
"""
import json
import logging
from functools import singledispatch
from typing import Any, Dict, List, Literal, Optional, Union

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

CREATE_ADJACENT_MODELS = ["ProfilerResponse", "SampleData"]


class BaseModel(PydanticBaseModel):
    """
    Base model for OpenMetadata generated models.
    Specified as `--base-class BASE_CLASS` in the generator.
    """

    @model_validator(mode="after")
    @classmethod
    def parse_name(  # pylint: disable=inconsistent-return-statements
        cls, values
    ):  # pylint: disable=too-many-locals
        """
        Primary entry point to process values based on their class.
        Uses singledispatch to dynamically call appropriate processing functions.
        """

        from metadata.generated.schema.api.data.createDashboard import (
            CreateDashboardRequest,
        )
        from metadata.generated.schema.api.data.createTable import CreateTableRequest
        from metadata.generated.schema.api.data.createTableProfile import (
            CreateTableProfileRequest,
        )
        from metadata.generated.schema.entity.data.table import (
            Column,
            Table,
            TableConstraint,
        )
        from metadata.profiler.processor.core import ColumnProfile, ProfilerResponse
        from metadata.profiler.source.metadata import ProfilerSourceAndEntity
        from metadata.utils.entity_link import CustomColumnName

        @singledispatch
        def validate_name_and_transform(_):
            """Single dispatch function to process name and display name based on object type."""

        @validate_name_and_transform.register
        def _(obj: CreateTableRequest):
            """Process CreateTableRequest type."""
            process_table_and_columns(obj, is_create=True)

        @validate_name_and_transform.register
        def _(obj: CreateTableProfileRequest):
            """Process CreateTableProfileRequest type."""
            for column_profile in obj.columnProfile or []:
                process_name_and_display_name(
                    column_profile, is_create=True, has_root=False
                )

        @validate_name_and_transform.register
        def _(obj: ProfilerResponse):
            """Process ProfilerResponse type."""
            process_table_and_columns(obj.table, is_create=True)
            if obj.sample_data and obj.sample_data.data:
                process_column_name(obj.sample_data.data.columns)

        @validate_name_and_transform.register
        def _(obj: Table):
            """Process Table type."""
            process_table_and_columns(obj, is_create=False)

        @validate_name_and_transform.register
        def _(obj: CustomColumnName):
            """Process CustomColumnName type."""
            obj.name = revert_separators(obj.name)

        @validate_name_and_transform.register
        def _(obj: ProfilerSourceAndEntity):
            """Process ProfilerSourceAndEntity type."""
            process_table_and_columns(obj.entity, is_create=False)

        @validate_name_and_transform.register
        def _(obj: CreateDashboardRequest):
            """Process ProfilerSourceAndEntity type."""
            process_table_and_columns(obj, is_create=False)

        def check_for_restricted_keywords(name_value: str) -> bool:
            return any(keyword in name_value for keyword in RESTRICTED_KEYWORDS)

        def check_for_reserved_keywords(name_value: str) -> bool:
            return any(
                keyword in name_value
                for keyword in [RESERVED_COLON_KEYWORD, RESERVED_ARROW_KEYWORD]
            )

        def process_name_and_display_name(
            obj: Union["CreateTableRequest", "Column", "Table", "ColumnProfile"],
            is_create: bool,
            has_root: bool = True,
        ) -> None:
            name_value: Optional[str] = obj.name.root if has_root else obj.name

            if name_value:
                if check_for_reserved_keywords(name_value) and not is_create:
                    if has_root and hasattr(obj.name, "root"):
                        obj.name.root = revert_separators(value=name_value)
                    else:
                        obj.name = revert_separators(value=name_value)
                    return

                if is_create and check_for_restricted_keywords(name_value=name_value):
                    if has_root:
                        obj.name.root = replace_separators(name_value)
                        if not obj.displayName:
                            obj.displayName = name_value
                    else:
                        obj.name = replace_separators(name_value)
                    return

        def revert_separators(value):
            return value.replace(RESERVED_COLON_KEYWORD, "::").replace(
                RESERVED_ARROW_KEYWORD, ">"
            )

        def replace_separators(value):
            return value.replace("::", RESERVED_COLON_KEYWORD).replace(
                ">", RESERVED_ARROW_KEYWORD
            )

        def process_column_name(values):
            for column in values:
                column.root = replace_separators(column.root)

        def process_table_and_columns(values, is_create: bool, has_root: bool = True):
            # Table Level
            process_name_and_display_name(
                values, is_create=is_create, has_root=has_root
            )
            # Column level
            columns = values.columns if hasattr(values, "columns") else None
            if columns:
                for column in columns:
                    process_name_and_display_name(
                        column, is_create=is_create, has_root=has_root
                    )
                if hasattr(values, "tableConstraints"):
                    table_constraints: List[TableConstraint] = values.tableConstraints
                    for constraint_obj in table_constraints or []:
                        for index, constraint_column in enumerate(
                            constraint_obj.columns or []
                        ):
                            constraint_obj.columns[index] = replace_separators(
                                constraint_column
                            )

        if not values:
            return

        try:

            validate_name_and_transform(values)
            # if class_name.startswith("Create") or class_name in CREATE_ADJACENT_MODELS:
            #     if isinstance(values, CreateTableRequest):
            #         process_table_and_columns(values, is_create=True)
            #     elif isinstance(values, CreateTableProfileRequest):
            #         for column_profile in values.columnProfile or []:
            #             validate_name_and_transform(
            #                 column_profile, is_create=True, has_root=False
            #             )
            #     elif isinstance(values, ProfilerResponse):
            #         process_table_and_columns(values.table, is_create=True)
            #         if values.sample_data and values.sample_data.data:
            #             process_column_name(values=values.sample_data.data.columns)
            # else:
            #     if isinstance(values, Table):
            #         process_table_and_columns(values, is_create=False)
            #     elif isinstance(values, CustomColumnName):
            #         values.name = revert_separators(values.name)
            #     elif isinstance(values, ProfilerSourceAndEntity):
            #         process_table_and_columns(values.entity, is_create=False)
        except Exception as exc:
            logger.error("Exception while parsing special characters: %s", exc)
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
