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
Diagnostics configuration.

Operator-tunable policy lives on `DiagnosticsConfig`; implementation-detail
constants stay with the module that owns them (e.g. registry caps). The
discriminator is "would an operator ever tune this?" — yes goes here, no
stays local.
"""

from dataclasses import dataclass

DIAG_LOG_PREFIX = "diag"


@dataclass(frozen=True)
class DiagnosticsConfig:
    """Operator-tunable diagnostics policy.

    Defaults are the validated production values. Injected via
    `DiagnosticsContext.build()`; a future `from_workflow_config()` can
    hydrate these from `workflowConfig` with no call-site changes.
    """

    watchdog_tick_seconds: float = 10
    stuck_warn_seconds: float = 60
    auto_dump_seconds: float = 300
    redump_throttle_seconds: float = 300
    heartbeat_interval_seconds: float = 30
    time_accounting_interval_seconds: float = 0.1
    pressure_psi_avg10_threshold: float = 10.0
    pressure_dump_throttle_seconds: float = 300
