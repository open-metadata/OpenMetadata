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
"""
Guard the forked dependencies against owning names that dbt projects install too.

Distributions with different names that write the same top-level package, console
script or dbt install silently overwrite each other (#37970, #37974).
"""

from importlib.metadata import distribution, requires

from packaging.requirements import Requirement


def test_collate_sqlfluff_does_not_claim_upstream_sqlfluff_names():
    dist = distribution("collate-sqlfluff")

    top_level_packages = {f.parts[0] for f in dist.files if len(f.parts) > 1}
    assert "sqlfluff" not in top_level_packages
    assert "collate_sqlfluff" in top_level_packages

    entry_points = {(ep.group, ep.name) for ep in dist.entry_points}
    assert ("console_scripts", "sqlfluff") not in entry_points
    assert ("diff_cover", "sqlfluff") not in entry_points
    assert not any(group == "sqlfluff" for group, _ in entry_points)


def test_collate_data_diff_does_not_require_dbt_core():
    base_requirements = {
        req.name.lower()
        for req in map(Requirement, requires("collate-data-diff") or [])
        if not (req.marker and "extra" in str(req.marker))
    }
    assert "dbt-core" not in base_requirements
    assert "mashumaro" not in base_requirements
