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
from pydantic import PlainSerializer
from pydantic.main import IncEx
from pydantic.types import SecretStr
from typing_extensions import Annotated

logger = logging.getLogger("metadata")

SECRET = "secret:"
JSON_ENCODERS = "json_encoders"


class BaseModel(PydanticBaseModel):
    """
    Base model for OpenMetadata generated models.
    Specified as `--base-class BASE_CLASS` in the generator.
    """

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
