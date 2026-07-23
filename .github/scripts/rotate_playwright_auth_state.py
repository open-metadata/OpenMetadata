#!/usr/bin/env python3

#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Replace cached Playwright sessions with freshly authenticated sessions."""

from __future__ import annotations

import argparse
import base64
import json
import os
import ssl
import tempfile
import urllib.request
from pathlib import Path
from typing import Any


ADMIN_EMAIL = "admin@open-metadata.org"
ADMIN_PASSWORD = "admin"
SEEDED_USER_PASSWORD = "User@OMD123"


def decode_jwt_payload(token: str) -> dict[str, Any]:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload.encode())
        value = json.loads(decoded)
    except (IndexError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError(
            "Playwright auth state contains an invalid access token"
        ) from exc
    if not isinstance(value, dict):
        raise ValueError("Playwright access token payload is not an object")
    return value


def app_state_record(storage_state: dict[str, Any]) -> dict[str, Any]:
    for origin in storage_state.get("origins", []):
        for database in origin.get("indexedDB", []):
            if database.get("name") != "AppDataStore":
                continue
            for store in database.get("stores", []):
                if store.get("name") != "keyValueStore":
                    continue
                for record in store.get("records", []):
                    if record.get("key") == "app_state":
                        return record
    raise ValueError("Playwright auth state has no AppDataStore app_state record")


def current_identity(storage_state: dict[str, Any]) -> tuple[str, str]:
    record = app_state_record(storage_state)
    try:
        token = json.loads(record["value"])["primary"]
    except (KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Playwright auth state has no primary access token") from exc
    payload = decode_jwt_payload(token)
    email = payload.get("email")
    if not isinstance(email, str) or not email:
        raise ValueError("Playwright access token has no email")
    if email == ADMIN_EMAIL:
        return email, ADMIN_PASSWORD
    if email.startswith("pw-") and email.endswith("@gmail.com"):
        return email, SEEDED_USER_PASSWORD
    raise ValueError(f"Refusing to rotate unknown cached Playwright user: {email}")


def login(base_url: str, email: str, password: str) -> str:
    body = json.dumps(
        {
            "email": email,
            "password": base64.b64encode(password.encode()).decode(),
        }
    ).encode()
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/v1/auth/login",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    ssl_context = (
        ssl._create_unverified_context() if base_url.startswith("https://") else None
    )
    try:
        with urllib.request.urlopen(
            request, timeout=30, context=ssl_context
        ) as response:
            payload = json.load(response)
    except Exception as exc:
        raise RuntimeError(
            f"Authentication failed for cached Playwright user {email}"
        ) from exc
    access_token = payload.get("accessToken") if isinstance(payload, dict) else None
    if not isinstance(access_token, str) or not access_token:
        raise RuntimeError(f"Authentication returned no access token for {email}")
    return access_token


def replace_session(
    storage_state: dict[str, Any], access_token: str, base_url: str
) -> None:
    payload = decode_jwt_payload(access_token)
    session_id = payload.get("sessionId")
    expires = payload.get("exp")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("Fresh access token has no session id")
    if not isinstance(expires, int):
        raise ValueError("Fresh access token has no integer expiry")

    record = app_state_record(storage_state)
    app_state = json.loads(record["value"])
    app_state["primary"] = access_token
    record["value"] = json.dumps(app_state, separators=(",", ":"))

    session_cookie = None
    for cookie in storage_state.get("cookies", []):
        if cookie.get("name") == "OM_SESSION":
            session_cookie = cookie
            break
    if session_cookie is None:
        raise ValueError("Playwright auth state has no OM_SESSION cookie")
    session_cookie.update(
        {
            "value": session_id,
            "expires": expires,
            "httpOnly": True,
            "secure": base_url.startswith("https://"),
            "sameSite": "Lax",
        }
    )


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        dir=path.parent, prefix=f".{path.name}."
    )
    try:
        with os.fdopen(descriptor, "w") as output:
            json.dump(payload, output, separators=(",", ":"))
            output.write("\n")
        os.chmod(temporary_name, 0o600)
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def rotate_auth_state(auth_dir: Path, base_url: str) -> str:
    admin_token = ""
    state_files = sorted(
        path for path in auth_dir.glob("*.json") if path.name != "admin-api-token.json"
    )
    if not state_files:
        raise RuntimeError(f"No Playwright storage state found in {auth_dir}")

    for state_file in state_files:
        storage_state = json.loads(state_file.read_text())
        email, password = current_identity(storage_state)
        access_token = login(base_url, email, password)
        replace_session(storage_state, access_token, base_url)
        atomic_write_json(state_file, storage_state)
        if email == ADMIN_EMAIL:
            admin_token = access_token

    if not admin_token:
        raise RuntimeError(
            "The cached Playwright state does not contain the admin user"
        )
    atomic_write_json(auth_dir / "admin-api-token.json", {"token": admin_token})
    return admin_token


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--auth-dir", type=Path, required=True)
    parser.add_argument("--base-url", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.auth_dir.is_dir():
        raise SystemExit(f"Auth state directory does not exist: {args.auth_dir}")
    rotate_auth_state(args.auth_dir, args.base_url)
    print(f"Rotated {len(list(args.auth_dir.glob('*.json'))) - 1} Playwright sessions")


if __name__ == "__main__":
    main()
