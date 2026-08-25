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
"""Ceilings on the cost of `import metadata`."""

import json
import subprocess
import sys

import pytest

# Loose on purpose: catch a step change, such as a new eagerly imported dependency
# subtree, rather than run-to-run variation. Lower them as lazy-import work lands.
MAX_IMPORT_RSS_MB = 400
MAX_TOTAL_MODULES = 5000

# Linux carries ru_maxrss across fork+exec, so under pytest it reports the runner's peak
# rather than this process's. VmHWM is per-process and survives that.
_MEASURE = """
import json, sys, warnings

warnings.filterwarnings("ignore")
import metadata  # noqa: F401


def peak_rss_mb():
    try:
        with open("/proc/self/status") as status:
            for line in status:
                if line.startswith("VmHWM:"):
                    return int(line.split()[1]) / 1024
    except OSError:
        pass
    import resource

    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak / (1024 * 1024) if sys.platform == "darwin" else peak / 1024


print(json.dumps({
    "rss_mb": peak_rss_mb(),
    "modules": len(sys.modules),
    "metadata_modules": sum(1 for name in sys.modules if name.startswith("metadata")),
}))
"""


@pytest.fixture(scope="module")
def import_cost() -> dict:
    result = subprocess.run([sys.executable, "-c", _MEASURE], capture_output=True, text=True, check=False)
    assert result.returncode == 0, f"measuring `import metadata` failed:\n{result.stdout}\n{result.stderr}"
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_import_metadata_peak_rss_under_ceiling(import_cost, record_property):
    rss_mb = import_cost["rss_mb"]
    # Recorded in the JUnit report so the ceilings can be tightened from real CI numbers
    # rather than guessed, since a passing assertion reveals nothing.
    record_property("import_rss_mb", round(rss_mb))
    record_property("import_modules", import_cost["modules"])
    assert rss_mb < MAX_IMPORT_RSS_MB, (
        f"`import metadata` peaked at {rss_mb:.0f} MB, ceiling {MAX_IMPORT_RSS_MB} MB. "
        "Make the new import lazy, or check whether defer_build is still enabled on the "
        "generated-model base class."
    )


def test_import_metadata_module_count_under_ceiling(import_cost):
    modules = import_cost["modules"]
    assert modules < MAX_TOTAL_MODULES, (
        f"`import metadata` loaded {modules} modules ({import_cost['metadata_modules']} "
        f"of them metadata.*), ceiling {MAX_TOTAL_MODULES}. Make the new import lazy."
    )
