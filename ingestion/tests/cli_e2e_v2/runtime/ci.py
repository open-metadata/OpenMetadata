#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""CI-native masking for fixture credentials."""

import os
import sys


def mask_secrets(*values: str) -> None:
    """Register nonempty values with GitHub Actions before they reach logs."""
    if os.environ.get("GITHUB_ACTIONS") != "true":
        return
    for value in values:
        if value:
            escaped = value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
            # xdist workers reserve stdout for their transport; stderr still reaches the CI runner.
            print(f"::add-mask::{escaped}", file=sys.stderr, flush=True)
