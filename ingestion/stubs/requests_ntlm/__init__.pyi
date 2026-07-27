from requests.auth import AuthBase

class HttpNtlmAuth(AuthBase):
    def __init__(self, username: str, password: str, **kwargs: object) -> None: ...
