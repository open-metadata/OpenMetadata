#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Typed, OM_-prefixed environment settings for ingestion, with a registry for docs.

Each OpenMetadata-owned setting is a field on a registered ``OMSettings`` subclass.
Group by domain — one class per category with ``env_prefix="OM_<CATEGORY>_"``; core
toggles use ``CoreSettings`` (``env_prefix="OM_"``). Connector/domain settings live in
that domain's own module so they load lazily; register each class with ``@om_settings``.
"""

import importlib
from pathlib import Path
from typing import Type  # noqa: UP035

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_REGISTRY: dict[str, Type["OMSettings"]] = {}  # noqa: UP006


class OMSettings(BaseSettings):
    """Base for all OpenMetadata env settings; every field resolves to an OM_-prefixed var."""

    model_config = SettingsConfigDict(extra="ignore", frozen=True, case_sensitive=False)


def om_settings(cls: Type["OMSettings"]) -> Type["OMSettings"]:  # noqa: UP006
    """Register an OMSettings subclass for documentation and prefix enforcement."""
    _REGISTRY[f"{cls.__module__}.{cls.__qualname__}"] = cls
    return cls


def registered_settings() -> dict[str, Type["OMSettings"]]:  # noqa: UP006
    """Return the registered settings classes keyed by import path."""
    return dict(_REGISTRY)


def import_all_settings_modules() -> dict[str, Type[OMSettings]]:  # noqa: UP006
    """Import every ``settings.py`` under the metadata package; return the registry."""
    import metadata  # noqa: PLC0415

    root = Path(metadata.__file__).parent
    for path in sorted(root.rglob("settings.py")):
        parts = path.relative_to(root).with_suffix("").parts
        if "generated" in parts:
            continue
        importlib.import_module("metadata." + ".".join(parts))
    return registered_settings()


@om_settings
class CoreSettings(OMSettings):
    """Cross-cutting framework toggles (OM_*)."""

    model_config = SettingsConfigDict(env_prefix="OM_")

    pydantic_defer_build: bool = Field(
        default=True,
        description=(
            "Build pydantic model schemas lazily on first use instead of at import, "
            "cutting import RSS. Read directly by the generated-model base class for "
            "import-safety; declared here for documentation and enforcement."
        ),
    )


@om_settings
class IngestionSettings(OMSettings):
    """Ingestion framework settings (OM_INGESTION_*)."""

    model_config = SettingsConfigDict(env_prefix="OM_INGESTION_")

    delete_async: bool = Field(
        default=False,
        description=(
            "Opt every connector into the server-side async delete cascade: mark-deletion "
            "calls fire DELETE /<entity>/async and return 202 + a jobId instead of blocking."
        ),
    )


core_settings = CoreSettings()
ingestion_settings = IngestionSettings()
