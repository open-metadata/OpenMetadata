from typing import Any


class FileFormatException(Exception):
    def __init__(self, config_source: Any, file_name: str) -> None:
        message = f"Missing implementation for {config_source.__class__.__name__} for {file_name}"
        super().__init__(message)
