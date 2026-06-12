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
"""
Pure data records for the test-connection engine.

The step status, skip-reason, and log-entry types live on the generated
``testConnectionResult`` schema; these are the engine-internal records the schema
does not model: what a successful check reports (``Evidence``) and a classified
failure (``Diagnosis``).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Diagnosis:
    """An actionable explanation of a failure, produced only when a rule matches."""

    title: str
    remediation: str | None = None
    doc_url: str | None = None


@dataclass(frozen=True)
class Evidence:
    """What a check self-reports on success: a summary and the command it ran."""

    summary: str | None = None
    command: str | None = None
