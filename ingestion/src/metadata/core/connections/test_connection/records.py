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
Engine-internal records the ``testConnectionResult`` schema does not model.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Diagnosis:
    """What a non-green condition is, and how to fix it.

    Produced by the error pack from a failure, or by a check as a caveat.
    """

    title: str
    remediation: str | None = None
    doc_url: str | None = None


@dataclass(frozen=True)
class Evidence:
    """What a check reports: a summary, the command it ran, and an optional caveat.

    A ``caveat`` makes the step a ``Warning`` while ``passed`` stays ``True``.
    """

    summary: str | None = None
    command: str | None = None
    caveat: Diagnosis | None = None
