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
Pydantic classes overwritten defaults ones of code generation.

This classes are used in the generated module, which should have NO
dependencies against any other metadata package. This class should
be self-sufficient with only pydantic at import time.
"""
import json
import logging
from typing import Any, Callable, Dict, Literal, Optional, Union

from pydantic import BaseModel as PydanticBaseModel
from pydantic import WrapSerializer, model_validator
from pydantic.main import IncEx
from pydantic.types import SecretStr
from pydantic_core.core_schema import SerializationInfo
from typing_extensions import Annotated

from metadata.ingestion.models.custom_basemodel_validation import (
    CREATE_ADJACENT_MODELS,
    FETCH_MODELS,
    replace_separators,
    revert_separators,
    validate_name_and_transform,
)

logger = logging.getLogger("metadata")

SECRET = "secret:"
JSON_ENCODERS = "json_encoders"


class BaseModel(PydanticBaseModel):
    """
    Base model for OpenMetadata generated models.
    Specified as `--base-class BASE_CLASS` in the generator.
    """

    def model_post_init(self, context: Any, /):
        """
        This function is used to parse the FilterPattern fields for the Connection classes.
        This is needed because dict is defined in the JSON schema for the FilterPattern field,
        but a FilterPattern object is required in the generated code.
        """
        # pylint: disable=import-outside-toplevel
        try:
            if not self.__class__.__name__.endswith("Connection"):
                # Only parse FilterPattern for Connection classes
                return
            for field in self.__pydantic_fields__:
                if field.endswith("FilterPattern"):
                    from metadata.generated.schema.type.filterPattern import (
                        FilterPattern,
                    )

                    value = getattr(self, field)
                    if isinstance(value, dict):
                        setattr(self, field, FilterPattern(**value))
        except Exception as exc:
            logger.warning(f"Exception while parsing FilterPattern: {exc}")

    @model_validator(mode="after")
    @classmethod
    def parse_name(cls, values):  # pylint: disable=inconsistent-return-statements
        """
        Primary entry point to process values based on their class.
        """

        if not values:
            return

        try:

            if cls.__name__ in CREATE_ADJACENT_MODELS or cls.__name__.startswith(
                "Create"
            ):
                values = validate_name_and_transform(values, replace_separators)
            elif cls.__name__ in FETCH_MODELS:
                values = validate_name_and_transform(values, revert_separators)

        except Exception as exc:
            logger.warning("Exception while parsing Basemodel: %s", exc)
            raise exc
        return values

    def model_dump_json(  # pylint: disable=too-many-arguments
        self,
        *,
        mask_secrets: Optional[bool] = None,
        indent: Optional[int] = None,
        include: IncEx = None,
        exclude: IncEx = None,
        context: Optional[Dict[str, Any]] = None,
        by_alias: bool = False,
        exclude_unset: bool = True,
        exclude_defaults: bool = False,
        exclude_none: bool = True,
        round_trip: bool = False,
        warnings: Union[bool, Literal["none", "warn", "error"]] = "none",
        fallback: Optional[Callable[[Any], Any]] = None,
        serialize_as_any: bool = False,
    ) -> str:
        """
        This is needed due to https://github.com/pydantic/pydantic/issues/8825

        We also tried the suggested `serialize` method but it did not
        work well with nested models.

        This solution is covered in the `test_pydantic_v2` test comparing the
        dump results from V1 vs. V2.

        mask_secrets: bool - Can be overridedn by either passing it as an argument or setting it in the context.
        With the following rules:
            - if mask_secrets is not None, it will be used as is
            - if mask_secrets is None and context is not None, it will be set to context.get("mask_secrets", True)
            - if mask_secrets is None and context is None, it will be set to True

        """
        if mask_secrets is None:
            mask_secrets = context.get("mask_secrets", True) if context else True
        return json.dumps(
            self.model_dump(
                mode="json",
                mask_secrets=mask_secrets,
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

    def model_dump(
        self,
        *,
        mask_secrets: bool = False,
        warnings: Union[bool, Literal["none", "warn", "error"]] = "none",
        **kwargs,
    ) -> Dict[str, Any]:
        if mask_secrets:
            context = kwargs.pop("context", None) or {}
            context["mask_secrets"] = True
            kwargs["context"] = context

        if "warnings" not in kwargs:
            kwargs["warnings"] = warnings

        return super().model_dump(**kwargs)


class _CustomSecretStr(SecretStr):
    """
    Custom SecretStr class which use the configured Secrets Manager to retrieve the actual values.

    If the secret string value starts with `config:` it will use the rest of the string as secret id to search for it
    in the secrets store.

    By default the secrets will be unmasked when dumping ot python objects and masked when dumping to json unless
    explicitly set otherwise using the `mask_secrets` or `context` arguments.
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


def handle_secret(value: Any, handler, info: SerializationInfo) -> str:
    """
    Handle the secret value in the model.
    """
    if not (info.context is not None and info.context.get("mask_secrets", False)):
        if info.mode == "json":
            # short circuit the json serialization and return the actual value
            return value.get_secret_value()
        return handler(value.get_secret_value())
    return str(value)  # use pydantic's logic to mask the secret


CustomSecretStr = Annotated[_CustomSecretStr, WrapSerializer(handle_secret)]


def ignore_type_decoder(type_: Any) -> None:
    """Given a type_, add a custom decoder to the BaseModel
    to ignore any decoding errors for that type_."""
    # We don't import the constants from the constants module to avoid circular imports
    BaseModel.model_config[JSON_ENCODERS][type_] = {
        lambda v: v.decode("utf-8", "ignore")
    }
