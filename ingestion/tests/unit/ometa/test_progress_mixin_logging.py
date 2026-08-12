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
"""
Progress endpoint failures must surface the server's response body.
"""

from requests import HTTPError, Response

from metadata.ingestion.ometa.mixins.progress_mixin import (
    RESPONSE_BODY_LOG_LIMIT,
    error_detail,
)


def http_error(body: str) -> HTTPError:
    response = Response()
    response.status_code = 400
    response._content = body.encode()
    return HTTPError("400 Client Error: Bad Request", response=response)


def test_response_body_is_reported():
    exc = http_error('{"code":400,"message":"Unable to process JSON"}')

    assert error_detail(exc) == ' - response: {"code":400,"message":"Unable to process JSON"}'


def test_long_response_body_is_truncated():
    exc = http_error("x" * (RESPONSE_BODY_LOG_LIMIT * 2))

    assert error_detail(exc) == f" - response: {'x' * RESPONSE_BODY_LOG_LIMIT}"


def test_empty_response_body_adds_nothing():
    assert error_detail(http_error("")) == ""


def test_exception_without_a_response_adds_nothing():
    assert error_detail(ValueError("boom")) == ""
