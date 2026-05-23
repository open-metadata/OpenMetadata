from typing import Any

class SecretManagerServiceClient:
    def __init__(self, **kwargs: Any) -> None: ...
    def access_secret_version(self, *, request: dict[str, str] | Any) -> AccessSecretVersionResponse: ...
    def secret_version_path(self, project: str, secret: str, secret_version: str) -> str: ...

class AccessSecretVersionResponse:
    payload: SecretPayload

class SecretPayload:
    data: bytes
    data_crc32c: int
