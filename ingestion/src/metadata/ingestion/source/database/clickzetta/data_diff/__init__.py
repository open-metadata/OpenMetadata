"""Opt-in ClickZetta adapter for the OpenMetadata data-diff validator."""

from metadata.ingestion.source.database.clickzetta.data_diff.data_diff import (
    ClickzettaDatabase,
    ClickzettaDialect,
    register_clickzetta_data_diff,
)

__all__ = ["ClickzettaDatabase", "ClickzettaDialect", "register_clickzetta_data_diff"]
