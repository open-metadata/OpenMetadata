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
"""Regenerate ingestion/SETTINGS.md from the registered OMSettings classes."""

from pathlib import Path

from metadata.config.settings_docs import import_all_settings_modules, render_settings_markdown


def main() -> None:
    """Write the rendered settings table to ingestion/SETTINGS.md."""
    doc = render_settings_markdown(import_all_settings_modules())
    out = Path(__file__).resolve().parents[1] / "SETTINGS.md"
    out.write_text(doc)
    print(f"wrote {out}")  # noqa: T201


if __name__ == "__main__":
    main()
