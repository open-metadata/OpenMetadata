import pytest

from identity_trust_sidecar.config import Settings


def test_config_requires_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OM_JWT_TOKEN", raising=False)

    with pytest.raises(Exception):
        Settings()
 
