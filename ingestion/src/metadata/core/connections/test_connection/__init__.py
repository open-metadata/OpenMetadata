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
Public API for the test-connection engine.

A connector imports the category-agnostic core from here (``check``,
``ChecksProvider``, ``Evidence``, ``ErrorPack``, ...) and its category-specific
checks from the matching module (e.g. ``checks.database``).
"""

from metadata.core.connections.test_connection.check import (
    ChecksProvider,
    StepName,
    check,
    collect_checks,
)
from metadata.core.connections.test_connection.classifier import (
    ErrorPack,
    Matchers,
    when,
)
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.core.connections.test_connection.runner import TestConnectionRunner

__all__ = [
    "ChecksProvider",
    "Diagnosis",
    "ErrorPack",
    "Evidence",
    "Matchers",
    "StepName",
    "TestConnectionRunner",
    "check",
    "collect_checks",
    "when",
]
