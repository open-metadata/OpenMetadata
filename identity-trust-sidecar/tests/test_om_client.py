import responses

from identity_trust_sidecar.om_client import OpenMetadataClient


def test_client_adds_bearer_token_header() -> None:
    client = OpenMetadataClient("http://example", "abc123")
    assert client._headers()["Authorization"] == "Bearer abc123"


@responses.activate
def test_create_thread_request_shape() -> None:
    client = OpenMetadataClient("http://om", "t")
    responses.add(
        responses.POST,
        "http://om/api/v1/feed",
        json={"id": "1"},
        status=200,
    )

    client.create_thread("table", "deadbeef", "hello")

    req = responses.calls[0].request
    assert req.headers["Authorization"] == "Bearer t"


@responses.activate
def test_create_task_request_shape() -> None:
    client = OpenMetadataClient("http://om", "t")
    responses.add(
        responses.POST,
        "http://om/api/v1/tasks",
        json={"id": "1"},
        status=200,
    )

    client.create_task(
        title="Review",
        description="Please review",
        about_link="<#E::table::deadbeef>",
        assignees=["user-id-1"],
    )

    req = responses.calls[0].request
    assert req.headers["Authorization"] == "Bearer t"
 
