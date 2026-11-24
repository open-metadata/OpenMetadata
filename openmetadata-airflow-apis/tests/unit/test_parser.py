#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import pytest
from pydantic import BaseModel, ConfigDict, ValidationError

from openmetadata_managed_apis.utils.parser import parse_validation_err


class ValidationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required: str
    port: int


def test_parse_validation_err_reports_fields_without_values():
    with pytest.raises(ValidationError) as exc_info:
        ValidationConfig.model_validate(
            {
                "port": "not-an-integer",
                "unexpected": "do-not-return",
            }
        )

    message = parse_validation_err(exc_info.value)

    assert message == "\n".join(
        (
            "Extra parameter 'unexpected'",
            "Missing parameter 'required'",
            "Invalid parameter value for 'port'",
        )
    )
    assert "not-an-integer" not in message
    assert "do-not-return" not in message
