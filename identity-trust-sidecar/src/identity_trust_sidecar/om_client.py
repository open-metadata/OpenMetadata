from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


@dataclass(frozen=True)
class OpenMetadataClient:
    base_url: str
    jwt_token: str

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jwt_token}"}

    def get_version(self) -> str:
        response = requests.get(
            f"{self.base_url}/api/v1/system/version",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        version = data.get("version")
        if not isinstance(version, str) or not version:
            raise ValueError("Missing or invalid version in response")

        return version

    def get_entity_by_fqn(self, entity_type: str, fqn: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}/api/v1/{entity_type}/name/{fqn}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()

        return response.json()

    def create_thread(self, entity_type: str, entity_id: str, message: str) -> None:
        payload: dict[str, Any] = {
            "from": "identity-trust-sidecar",
            "message": message,
            "about": f"<#E::{entity_type}::{entity_id}>",
            "type": "Conversation",
        }
        response = requests.post(
            f"{self.base_url}/api/v1/feed",
            headers={**self._headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

    def create_task(
        self, title: str, description: str, about_link: str, assignees: list[str]
    ) -> None:
        payload: dict[str, Any] = {
            "type": "Request",
            "status": "Open",
            "name": title,
            "description": description,
            "about": about_link,
            "assignees": assignees,
        }
        response = requests.post(
            f"{self.base_url}/api/v1/tasks",
            headers={**self._headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
 
