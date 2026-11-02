from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from metadata.ingestion.source.database.timescale.metadata import TimescaleSource

__all__ = ["TimescaleSource"]


def __getattr__(name: str):
    if name == "TimescaleSource":
        from metadata.ingestion.source.database.timescale.metadata import TimescaleSource

        return TimescaleSource
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
