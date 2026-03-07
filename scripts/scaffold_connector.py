#!/usr/bin/env python3
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
Thin wrapper to run the scaffold-connector command.

Preferred usage:
    metadata scaffold-connector              # Interactive mode
    metadata scaffold-connector --name X ... # Non-interactive mode

This script is provided for convenience when the `metadata` CLI is not
installed:
    python scripts/scaffold_connector.py     # Interactive mode
"""
import sys
from pathlib import Path

# Ensure the ingestion source is on the path
ingestion_src = Path(__file__).resolve().parent.parent / "ingestion" / "src"
if str(ingestion_src) not in sys.path:
    sys.path.insert(0, str(ingestion_src))

from metadata.cmd import metadata  # noqa: E402

if __name__ == "__main__":
    metadata(["scaffold-connector"] + sys.argv[1:])
