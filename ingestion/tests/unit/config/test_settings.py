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
"""Enforcement for OM_ settings: prefix, no raw env reads, documentation coverage."""

import re
from pathlib import Path

import metadata
from metadata.config.settings import OMSettings
from metadata.config.settings_docs import import_all_settings_modules

_METADATA_ROOT = Path(metadata.__file__).parent
_SETTINGS_MD = Path(__file__).resolve().parents[3] / "SETTINGS.md"

_RAW_ENV_PATTERN = re.compile(r"""os\.(?:environ(?:\.get)?|getenv)\s*[(\[]\s*['"]OM_""")

# custom_pydantic reads OM_PYDANTIC_DEFER_BUILD directly: it is the generated-model base
# class and must not import another metadata package at import time (circular imports).
_RAW_ENV_ALLOWLIST = {"ingestion/models/custom_pydantic.py"}


def test_registered_settings_use_om_prefix():
    registry = import_all_settings_modules()
    assert registry, "no OM settings registered"
    for path, cls in registry.items():
        assert issubclass(cls, OMSettings), path
        prefix = cls.model_config.get("env_prefix", "")
        assert prefix.startswith("OM_"), f"{path}: env_prefix {prefix!r} must start with 'OM_'"


def test_no_raw_om_env_reads_outside_settings():
    offenders = []
    for py in _METADATA_ROOT.rglob("*.py"):
        rel = py.relative_to(_METADATA_ROOT).as_posix()
        if "generated/" in rel or rel.endswith("settings.py") or rel in _RAW_ENV_ALLOWLIST:
            continue
        if _RAW_ENV_PATTERN.search(py.read_text()):
            offenders.append(rel)
    assert not offenders, f"raw OM_ env reads must move to metadata.config.settings: {offenders}"


def test_all_settings_documented():
    doc = _SETTINGS_MD.read_text()
    for cls in import_all_settings_modules().values():
        prefix = cls.model_config.get("env_prefix", "")
        for field_name in cls.model_fields:
            env = f"{prefix}{field_name}".upper()
            assert env in doc, f"{env} missing from SETTINGS.md — run scripts/generate_settings_docs.py"
