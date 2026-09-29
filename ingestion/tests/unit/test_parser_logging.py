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

import logging
from unittest.mock import patch

from pydantic import BaseModel

from metadata.ingestion.api.parser import _parse_inner_connection


class InnerConnection(BaseModel):
    type: str


def test_inner_connection_debug_log_does_not_echo_configured_type(caplog):
    configured_type = "connector-type-with-sensitive-text"

    with (
        patch("metadata.ingestion.api.parser.get_service_type", return_value="Database"),
        patch("metadata.ingestion.api.parser.get_connection_class", return_value=InnerConnection),
        caplog.at_level(logging.DEBUG, logger="metadata.Ingestion"),
    ):
        _parse_inner_connection({"type": configured_type})

    assert "Error parsing the inner service connection" in caplog.text
    assert configured_type not in caplog.text
