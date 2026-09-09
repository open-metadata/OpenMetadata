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

from http import HTTPStatus

import pytest
from flask import Flask

from openmetadata_managed_apis.api.response import ApiResponse


def test_server_error_does_not_expose_internal_details():
    internal_detail = "Traceback: password=do-not-return"

    with Flask(__name__).app_context():
        responses = (
            ApiResponse.error(ApiResponse.STATUS_SERVER_ERROR, internal_detail),
            ApiResponse.server_error(),
        )
        for response in responses:
            assert response.status_code == ApiResponse.STATUS_SERVER_ERROR
            assert response.get_json() == {"error": "An unexpected problem occurred"}
            assert internal_detail.encode() not in response.data


def test_client_error_keeps_safe_actionable_message():
    message = "Did not receive any JSON request to deploy"

    with Flask(__name__).app_context():
        response = ApiResponse.bad_request(message)
        assert response.status_code == ApiResponse.STATUS_BAD_REQUEST
        assert response.get_json() == {"error": message}


@pytest.mark.parametrize(
    "status,error,expected_status,expected_error",
    [
        (None, "Internal detail", ApiResponse.STATUS_SERVER_ERROR, ApiResponse.UNEXPECTED_ERROR),
        (HTTPStatus.BAD_REQUEST, "Invalid request", ApiResponse.STATUS_BAD_REQUEST, "Invalid request"),
        (499, "Client closed request", 499, "Client closed request"),
    ],
)
def test_error_handles_missing_enum_and_nonstandard_statuses(status, error, expected_status, expected_error):
    with Flask(__name__).app_context():
        response = ApiResponse.error(status, error)
        assert response.status_code == expected_status
        assert response.get_json() == {"error": expected_error}
