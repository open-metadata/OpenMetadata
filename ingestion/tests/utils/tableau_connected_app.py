#  Copyright 2026 Collate
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
A Tableau connected app (direct trust) as the Tableau tests see it: its credentials, the scopes its
token must carry, and Tableau's sign-in answer for the fake sites of the integration tests.
"""

import xml.etree.ElementTree as ET

import jwt

NS = 'xmlns="http://tableau.com/api"'
PAT = {"personalAccessTokenName": "pat", "personalAccessTokenSecret": "secret"}
CONNECTED_APP = {
    "clientId": "3d6e1b5c-client",
    "secretId": "9a2f7c4e-secret",
    "secretValue": "connected-app-secret-value-of-44-characters!",
    "username": "api-user@example.com",
}
# Every scope a call of the dashboard or pipeline connector needs, measured on Tableau Cloud.
CONNECTED_APP_SCOPES = [
    "tableau:content:read",
    "tableau:users:read",
    "tableau:server:read",
    "tableau:flows:read",
    "tableau:flow_runs:read",
    "tableau:jobs:read",
    "tableau:tasks:read",
]


def connected_app_claims(token: str) -> dict:
    return jwt.decode(token, CONNECTED_APP["secretValue"], algorithms=["HS256"], audience="tableau")


def _is_accepted(token: str) -> bool:
    """What Tableau's direct trust checks at sign-in: the HS256 signature with the app's secret, the
    secret ID and client ID in the header, the audience and issuer, and the claims it requires."""
    try:
        jwt.decode(
            token,
            CONNECTED_APP["secretValue"],
            algorithms=["HS256"],
            audience="tableau",
            issuer=CONNECTED_APP["clientId"],
            options={"require": ["exp", "jti", "sub", "scp"]},
        )
    except jwt.InvalidTokenError:
        return False
    header = jwt.get_unverified_header(token)
    return (header.get("kid"), header.get("iss")) == (CONNECTED_APP["secretId"], CONNECTED_APP["clientId"])


def sign_in(body: bytes) -> tuple[int, str]:
    """Tableau's answer to a sign-in request: a PAT is accepted as is, a connected-app JWT only if valid."""
    token = ET.fromstring(body).find("credentials").get("jwt")
    if token and not _is_accepted(token):
        return 401, (
            f'<tsResponse {NS}><error code="401001"><summary>Signin Error</summary>'
            "<detail>Invalid connected app token</detail></error></tsResponse>"
        )
    return 200, (
        f'<tsResponse {NS}><credentials token="t"><site id="site-it" contentUrl="it"/>'
        '<user id="api-user"/></credentials></tsResponse>'
    )
