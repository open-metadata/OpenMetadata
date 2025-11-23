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
"""Unit tests for SSEClient"""

import json
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from unittest.mock import Mock, patch

import httpx
import pytest

from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.ometa.sse_client import SSEClient


class MockSSEResponse:
    """Mock SSE response that simulates streaming behavior"""

    def __init__(
        self,
        lines: list[str],
        status_code: int = 200,
        raise_error: Optional[Exception] = None,
    ):
        self.lines: list[str] = lines
        self.status_code: int = status_code
        self.raise_error: Optional[Exception] = raise_error

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "HTTP error",
                request=Mock(),
                response=Mock(status_code=self.status_code),
            )

    def iter_lines(self) -> Iterator[str]:
        if self.raise_error:
            raise self.raise_error
        yield from self.lines

    def __enter__(self):
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        return False


class MockHTTPXClient:
    """Mock httpx.Client for SSE streaming"""

    def __init__(self, response: MockSSEResponse):
        self.response: MockSSEResponse = response

    def stream(
        self,
        method: str,
        url: str,
        headers: Optional[dict[str, str]] = None,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> MockSSEResponse:
        return self.response

    def __enter__(self) -> "MockHTTPXClient":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        return False


@pytest.fixture
def mock_client_config():
    """Create a mock ClientConfig for testing"""
    config = Mock(spec=ClientConfig)
    config.base_url = "http://localhost:8585/api"
    config.api_version = "v1"
    config.auth_header = "Authorization"
    config.auth_token_mode = "Bearer"
    config.access_token = "test_token"
    config.expires_in = None
    config.allow_redirects = True
    config.verify = True
    config.cookies = None
    config.auth_token = Mock(return_value=("test_token", 3600))
    return config


@pytest.fixture
def sse_client(mock_client_config):
    """Create an SSEClient instance for testing"""
    return SSEClient(config=mock_client_config, max_retries=3, retry_delay=0.1)


def test_sse_client_initialization(mock_client_config):
    """Test SSEClient initialization with config"""
    client = SSEClient(config=mock_client_config, max_retries=5, retry_delay=2)

    assert client.config == mock_client_config
    assert client.max_retries == 5
    assert client.retry_delay == 2
    assert client.last_event_id is None
    assert client.stream_completed is False


def test_stream_with_events(sse_client, mock_client_config):
    """Test streaming SSE events successfully"""
    sse_lines = [
        "event: message",
        "data: test message 1",
        "",
        "event: update",
        "data: test message 2",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 2","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/events"))

    assert len(events) == 3
    assert events[0] == {"event": "message", "data": "test message 1"}
    assert events[1] == {"event": "update", "data": "test message 2"}
    assert events[2] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 2","type":"completed"}',
    }
    assert sse_client.stream_completed is True


def test_stream_filters_comment_lines(sse_client, mock_client_config):
    """Test that comment lines starting with : are filtered out"""
    sse_lines = [
        ": this is a comment",
        "event: message",
        "data: test message",
        ": another comment",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/events"))

    assert len(events) == 2
    assert events[0] == {"event": "message", "data": "test message"}
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }
    assert sse_client.stream_completed is True


def test_stream_with_auth_headers(sse_client, mock_client_config):
    """Test that authentication headers are properly set"""
    sse_lines = [
        "event: message",
        "data: test message",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_headers = {}

    def mock_stream(method, url, headers=None, json=None, params=None):
        captured_headers.update(headers or {})
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events"))

    assert captured_headers.get("Authorization") == "Bearer test_token"
    assert captured_headers.get("Accept") == "text/event-stream"


def test_stream_with_post_method_and_data(sse_client, mock_client_config):
    """Test streaming with POST method and data payload"""
    sse_lines = [
        "event: message",
        "data: response",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_method = None
    captured_data = None

    def mock_stream(method, url, headers=None, json=None, params=None):
        nonlocal captured_method
        captured_method = method
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("POST", "/events", data={"key": "value"}))

    assert captured_method == "POST"


def test_stream_with_get_method_converts_data_to_params(sse_client):
    """Test that GET requests convert data to params"""
    sse_lines = [
        "event: message",
        "data: response",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events", data={"key": "value"}))


def test_stream_http_error_raises_immediately(sse_client):
    """Test that HTTP errors are raised immediately without retries"""
    mock_response = MockSSEResponse([], status_code=404)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        with pytest.raises(httpx.HTTPStatusError):
            list(sse_client.stream("GET", "/events"))


def test_stream_connection_error_with_retries(sse_client):
    """Test that connection errors trigger retries"""
    call_count = 0

    def create_mock_client(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count < 3:
            mock_response = MockSSEResponse(
                [], raise_error=httpx.ConnectError("Connection failed")
            )
        else:
            mock_response = MockSSEResponse(
                [
                    "event: message",
                    "data: success",
                    "",
                    "event: stream-complete",
                    'data: {"message":"total messages: 1","type":"completed"}',
                    "",
                ]
            )

        return MockHTTPXClient(mock_response)

    with patch("httpx.Client", side_effect=create_mock_client):
        with patch("time.sleep"):
            events = list(sse_client.stream("GET", "/events"))

    assert call_count == 3
    assert len(events) == 2
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }


def test_stream_max_retries_exceeded(sse_client):
    """Test that max retries are respected and exception is raised"""
    mock_response = MockSSEResponse(
        [], raise_error=httpx.ConnectError("Connection failed")
    )
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        with patch("time.sleep"):
            with pytest.raises(httpx.ConnectError):
                list(sse_client.stream("GET", "/events"))


def test_stream_with_last_event_id(sse_client):
    """Test that Last-Event-ID header is set when reconnecting"""
    sse_client.last_event_id = "event-123"

    sse_lines = [
        "event: message",
        "data: test",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_headers = {}

    def mock_stream(method, url, headers=None, json=None, params=None):
        captured_headers.update(headers or {})
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events"))

    assert captured_headers.get("Last-Event-ID") == "event-123"


def test_stream_resets_retry_count_on_success(sse_client):
    """Test that retry count is reset after successful connection"""
    call_count = 0

    def create_mock_client(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count == 1:
            mock_response = MockSSEResponse(
                [], raise_error=httpx.ConnectError("Connection failed")
            )
        else:
            mock_response = MockSSEResponse(
                [
                    "event: message",
                    "data: success",
                    "",
                    "event: stream-complete",
                    'data: {"message":"total messages: 1","type":"completed"}',
                    "",
                ]
            )

        return MockHTTPXClient(mock_response)

    with patch("httpx.Client", side_effect=create_mock_client):
        with patch("time.sleep"):
            events = list(sse_client.stream("GET", "/events"))

    assert call_count == 2
    assert len(events) == 2
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }


def test_validate_access_token_with_expired_token(sse_client, mock_client_config):
    """Test token refresh when token is expired"""
    mock_client_config.expires_in = datetime.now(timezone.utc).timestamp() - 100
    mock_client_config.access_token = "old_token"
    mock_client_config.auth_token = Mock(return_value=("new_token", 3600))

    sse_client._validate_access_token()

    assert mock_client_config.access_token == "new_token"
    assert mock_client_config.expires_in is not None


def test_validate_access_token_with_missing_token(sse_client, mock_client_config):
    """Test token refresh when token is missing"""
    mock_client_config.access_token = None
    mock_client_config.auth_token = Mock(return_value=("new_token", 3600))

    sse_client._validate_access_token()

    assert mock_client_config.access_token == "new_token"


def test_validate_access_token_with_datetime_expiry(sse_client, mock_client_config):
    """Test token refresh with datetime expiry"""
    future_time = datetime.now(timezone.utc) + timedelta(hours=1)
    mock_client_config.access_token = None
    mock_client_config.auth_token = Mock(return_value=("new_token", future_time))

    sse_client._validate_access_token()

    assert mock_client_config.access_token == "new_token"
    assert mock_client_config.expires_in == future_time.timestamp() - 120


def test_validate_access_token_with_no_token_mode(sse_client, mock_client_config):
    """Test token validation with 'no_token' mode"""
    mock_client_config.access_token = None
    mock_client_config.auth_token = Mock(return_value=("no_token", None))

    sse_client._validate_access_token()

    assert mock_client_config.access_token == "no_token"
    assert mock_client_config.expires_in is None


def test_stream_with_empty_lines_separating_events(sse_client):
    """Test handling of multiple empty lines between events"""
    sse_lines = [
        "event: message",
        "data: event1",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
        "",
        "event: message",
        "data: event2",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/events"))

    assert len(events) == 2
    assert events[0] == {"event": "message", "data": "event1"}
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }


def test_stream_constructs_correct_url(sse_client, mock_client_config):
    """Test that the URL is constructed correctly"""
    sse_lines = [
        "event: message",
        "data: test",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_url = None

    def mock_stream(method, url, headers=None, json=None, params=None):
        nonlocal captured_url
        captured_url = str(url)
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events"))

    assert captured_url == "http://localhost:8585/api/v1/events"


def test_stream_with_no_auth_header(sse_client, mock_client_config):
    """Test streaming without auth header"""
    mock_client_config.auth_header = None

    sse_lines = [
        "event: message",
        "data: test",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_headers = {}

    def mock_stream(method, url, headers=None, json=None, params=None):
        captured_headers.update(headers or {})
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events"))

    assert "Authorization" not in captured_headers
    assert captured_headers.get("Accept") == "text/event-stream"


def test_stream_with_no_auth_token_mode(sse_client, mock_client_config):
    """Test authentication header without token mode"""
    mock_client_config.auth_token_mode = None

    sse_lines = [
        "event: message",
        "data: test",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]
    mock_response = MockSSEResponse(sse_lines)

    captured_headers = {}

    def mock_stream(method, url, headers=None, json=None, params=None):
        captured_headers.update(headers or {})
        return mock_response

    mock_http_client = Mock()
    mock_http_client.stream = mock_stream
    mock_http_client.__enter__ = Mock(return_value=mock_http_client)
    mock_http_client.__exit__ = Mock(return_value=False)

    with patch("httpx.Client", return_value=mock_http_client):
        list(sse_client.stream("GET", "/events"))

    assert captured_headers.get("Authorization") == "test_token"


def test_stream_exponential_backoff_on_retries(sse_client):
    """Test that retry delay increases with each attempt"""
    call_count = 0
    sleep_delays = []

    def mock_sleep(delay):
        sleep_delays.append(delay)

    def create_mock_client(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count < 3:
            mock_response = MockSSEResponse(
                [], raise_error=httpx.ReadError("Read failed")
            )
        else:
            mock_response = MockSSEResponse(
                [
                    "event: message",
                    "data: success",
                    "",
                    "event: stream-complete",
                    'data: {"message":"total messages: 1","type":"completed"}',
                    "",
                ]
            )

        return MockHTTPXClient(mock_response)

    with patch("httpx.Client", side_effect=create_mock_client):
        with patch("time.sleep", side_effect=mock_sleep):
            events = list(sse_client.stream("GET", "/events"))

    assert len(sleep_delays) == 2
    assert sleep_delays[0] < sleep_delays[1]


def test_stream_with_multiline_event_data(sse_client):
    """Test handling of events with multiple data fields"""
    sse_lines = [
        "event: multiline",
        "data: line 1",
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/events"))

    assert len(events) == 2
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }
    assert events[0] == {"event": "multiline", "data": "line 1"}


def test_stream_with_realistic_stream_start_event(sse_client):
    """Test parsing realistic stream-start event with id and JSON data"""
    sse_lines = [
        "event: stream-start",
        "id: 0",
        'data: {"streamId":"test-stream-id","conversationId":"test-conv-id","sequence":0}',
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/chat/stream"))

    assert len(events) == 2
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }
    event = events[0]
    assert event["event"] == "stream-start"
    assert event["id"] == "0"
    assert sse_client.last_event_id == "0"

    data_json = json.loads(event["data"])
    assert data_json["streamId"] == "test-stream-id"
    assert data_json["conversationId"] == "test-conv-id"
    assert data_json["sequence"] == 0


def test_stream_with_realistic_message_event(sse_client):
    """Test parsing realistic message event with complex nested JSON"""
    sse_lines = [
        "event: message",
        "id: test-message-id",
        'data: {"streamId":"stream-123","conversationId":"conv-456","sequence":1,"data":{"message":{"sender":"system","index":0,"content":[{"textMessage":{"type":"markdown","message":"Test message"}}]},"type":"update"}}',
        "",
        "event: stream-complete",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/chat/stream"))

    assert len(events) == 2
    assert events[1] == {
        "event": "stream-complete",
        "data": '{"message":"total messages: 1","type":"completed"}',
    }
    event = events[0]
    assert event["event"] == "message"
    assert event["id"] == "test-message-id"
    assert sse_client.last_event_id == "test-message-id"

    data_json = json.loads(event["data"])
    assert data_json["streamId"] == "stream-123"
    assert data_json["data"]["message"]["sender"] == "system"
    assert (
        data_json["data"]["message"]["content"][0]["textMessage"]["message"]
        == "Test message"
    )


def test_stream_with_stream_completed_event_terminates(sse_client):
    """Test that stream-completed event terminates the stream"""
    sse_lines = [
        "event: message",
        "data: first message",
        "",
        "event: stream-completed",
        'data: {"message":"total messages: 1","type":"completed"}',
        "",
        "event: message",
        "data: this should not be received",
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/chat/stream"))

    assert len(events) == 2
    assert events[0]["event"] == "message"
    assert events[1]["event"] == "stream-completed"
    assert sse_client.stream_completed is True

    data_json = json.loads(events[1]["data"])
    assert data_json["message"] == "total messages: 1"
    assert data_json["type"] == "completed"


def test_stream_with_error_event_terminates(sse_client):
    """Test that stream-error event terminates the stream"""
    sse_lines = [
        "event: message",
        "data: first message",
        "",
        "event: stream-error",
        'data: {"error":"Something went wrong","type":"error"}',
        "",
        "event: message",
        "data: this should not be received",
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/chat/stream"))

    assert len(events) == 2
    assert events[0]["event"] == "message"
    assert events[1]["event"] == "stream-error"
    assert sse_client.stream_completed is True


def test_stream_with_complete_realistic_flow(sse_client):
    """Test complete flow with stream-start, message, and stream-completed events"""
    sse_lines = [
        "event: stream-start",
        "id: 0",
        'data: {"streamId":"flow-stream","conversationId":"flow-conv","sequence":0}',
        "",
        "event: message",
        "id: flow-msg-1",
        'data: {"streamId":"flow-stream","sequence":1,"data":{"message":{"sender":"assistant","content":[{"textMessage":{"message":"First message"}}]}}}',
        "",
        "event: message",
        "id: flow-msg-2",
        'data: {"streamId":"flow-stream","sequence":2,"data":{"message":{"sender":"assistant","content":[{"textMessage":{"message":"Second message"}}]}}}',
        "",
        "event: stream-completed",
        'data: {"message":"total messages: 2","type":"completed"}',
        "",
    ]

    mock_response = MockSSEResponse(sse_lines)
    mock_http_client = MockHTTPXClient(mock_response)

    with patch("httpx.Client", return_value=mock_http_client):
        events = list(sse_client.stream("GET", "/chat/stream"))

    assert len(events) == 4

    start_event = events[0]
    assert start_event["event"] == "stream-start"
    start_data = json.loads(start_event["data"])
    assert start_data["sequence"] == 0

    msg1_event = events[1]
    assert msg1_event["event"] == "message"
    msg1_data = json.loads(msg1_event["data"])
    assert msg1_data["sequence"] == 1

    msg2_event = events[2]
    assert msg2_event["event"] == "message"
    msg2_data = json.loads(msg2_event["data"])
    assert msg2_data["sequence"] == 2

    completed_event = events[3]
    assert completed_event["event"] == "stream-completed"
    assert sse_client.stream_completed is True


def test_parse_sse_event_with_event_field(sse_client):
    """Test parsing SSE event with event field"""
    event_buffer = ["event: test-event", "data: test data"]
    parsed = sse_client._parse_sse_event(event_buffer)

    assert parsed["event"] == "test-event"
    assert parsed["data"] == "test data"


def test_parse_sse_event_with_id_updates_last_event_id(sse_client):
    """Test that parsing event with ID updates last_event_id"""
    event_buffer = ["event: message", "id: event-123", "data: test"]
    parsed = sse_client._parse_sse_event(event_buffer)

    assert parsed["id"] == "event-123"
    assert sse_client.last_event_id == "event-123"


def test_parse_sse_event_with_completion_sets_flag(sse_client):
    """Test that parsing completed event sets stream_completed flag"""
    event_buffer = ["event: stream-completed", "data: done"]
    parsed = sse_client._parse_sse_event(event_buffer)

    assert parsed["event"] == "stream-completed"
    assert sse_client.stream_completed is True


def test_parse_sse_event_with_error_sets_flag(sse_client):
    """Test that parsing error event sets stream_completed flag"""
    event_buffer = ["event: stream-error", "data: error message"]
    parsed = sse_client._parse_sse_event(event_buffer)

    assert parsed["event"] == "stream-error"
    assert sse_client.stream_completed is True


def test_parse_sse_event_with_colon_in_data(sse_client):
    """Test parsing event with colon in data field"""
    event_buffer = ["event: message", 'data: {"key":"value:with:colons"}']
    parsed = sse_client._parse_sse_event(event_buffer)

    assert parsed["event"] == "message"
    assert parsed["data"] == '{"key":"value:with:colons"}'
