"""Base class for resource tests."""

from locust.contrib.fasthttp import FastHttpSession
from requests.auth import AuthBase


class BearerAuth(AuthBase):
    def __init__(self, token):
        self.token = token

    def __call__(self, r):
        r.headers["authorization"] = "Bearer " + self.token
        return r


def login_user(client: FastHttpSession) -> BearerAuth:
    resp = client.post(
        "/api/v1/users/login",
        json={"email": "admin@open-metadata.org", "password": "YWRtaW4="},
    )
    token = resp.json().get("accessToken")
    return BearerAuth(token)
