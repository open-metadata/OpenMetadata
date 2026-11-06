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
"""Constants for the test-connection engine."""

# Per-step wall-clock cap; a check exceeding it is mapped to a failed step.
STEP_TIMEOUT_SECONDS = 60

# Per-host TCP reachability preflight cap; comfortably under the per-step budget so
# an unreachable host fails as a network problem instead of waiting out the step,
# while leaving the handshake enough headroom for slow / cross-region hosts.
NETWORK_PROBE_TIMEOUT_SECONDS = 20
