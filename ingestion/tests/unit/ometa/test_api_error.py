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
"""APIError must describe error bodies that do not carry a `message` key."""

import pytest

from metadata.ingestion.ometa.client import APIError


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({"code": 404, "message": "Entity not found"}, "Entity not found"),
        ({"code": "400000", "title": "Invalid Payload", "detail": "bad column"}, "bad column"),
        ({"code": "400000", "title": "Invalid Payload"}, "Invalid Payload"),
        ({"code": "500000"}, "{'code': '500000'}"),
    ],
)
def test_api_error_message(body, expected):
    error = APIError(body)

    assert str(error) == expected
    assert error.code == body["code"]
