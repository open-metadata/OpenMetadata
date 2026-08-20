#!/usr/bin/env bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Strip spaCy's bundled CI test fixture from the installed package.
#
# spacy/tests/package/requirements.txt pins black==22.3.0. Image scanners parse it as a
# dependency manifest and report the pinned version as an installed package, which surfaces
# as CVE-2026-31900 (Critical), CVE-2026-32274 (High) and CVE-2024-21503 (Medium) against
# every image that ships spaCy. black itself is not installed in any release image -- it is
# a dev-extra only -- so these are scanner artifacts, not reachable code. The fixture is
# test-only data and is never imported at runtime.
#
# Run this after the final pip install of any image that ships spaCy; a later install that
# replaces the spaCy tree restores the fixture.
#
# This step can never fail a build. Every path exits 0 -- deliberately not `set -e`. The
# fixture is inert data, so the worst outcome of a failed strip is three findings in the
# next scan report, which is not worth blocking a release for. Problems are reported as
# WARNING on stderr and are visible in the build log.

set -uo pipefail

# `python` is tried first, not `python3`: pip installs into whichever interpreter `python`
# resolves to in these images (in the airflow base that is ~/.local/bin/python, not the
# system one), so preferring `python3` could scan a different site-packages than the one the
# fixture was installed into. `python3` is the fallback for a base image that ships no
# `python` shim -- without it the strip would silently skip and the black findings would
# survive a green build.
PYTHON="$(command -v python || command -v python3 || true)"
if [ -z "${PYTHON}" ]; then
  echo "WARNING: no python interpreter on PATH; skipping spacy test-fixture strip" >&2
  exit 0
fi

"${PYTHON}" - <<'PY'
import os
import sys

# Walk every sys.path entry rather than resolving spaCy once via find_spec. A user-site
# install shadows a system-site one, so find_spec reports only the shadowing copy and the
# other stays on disk -- where the scanner still reads it. That failure is silent: the
# build goes green and the finding survives.
def spacy_test_dirs():
    seen, found = set(), []
    for entry in sys.path:
        if not entry:
            continue
        tests_dir = os.path.join(entry, "spacy", "tests")
        key = os.path.realpath(tests_dir)
        if key not in seen and os.path.isdir(tests_dir):
            seen.add(key)
            found.append(tests_dir)
    return found


def fixtures_in(dirs):
    return [
        os.path.join(root, name)
        for d in dirs
        for root, _, files in os.walk(d)
        for name in files
        if name == "requirements.txt"
    ]


test_dirs = spacy_test_dirs()
if not test_dirs:
    print("spacy not installed, or ships no tests/ directory; nothing to strip")
    raise SystemExit(0)

blocked = []
removed = 0
for path in fixtures_in(test_dirs):
    try:
        os.remove(path)
        removed += 1
    except OSError as exc:
        blocked.append(f"{path}: {exc}")

# Re-scan rather than trust the deletes: the scanner reads the file off disk whether or not
# spaCy imports, so a partial delete has to be reported. Deliberately non-fatal -- this is
# scanner hygiene for a fixture that is never imported, and it must not be able to break a
# release build. A surviving copy costs three findings in the next report, not an outage.
# flush: stdout is block-buffered when the build pipes it, so without this the summary
# lands after the stderr warning below and the log reads back-to-front.
print(f"stripped {removed} spacy test fixture(s) from: {', '.join(test_dirs)}", flush=True)

leftover = fixtures_in(test_dirs)
if leftover:
    sys.stderr.write("WARNING: spacy test fixture survived the strip:\n")
    for path in leftover:
        sys.stderr.write(f"  {path}\n")
    for reason in blocked:
        sys.stderr.write(f"  {reason}\n")
    sys.stderr.write(
        "Image scanners will keep reporting black CVE-2026-31900 / CVE-2026-32274 / "
        "CVE-2024-21503 against these paths. This layer must run as a user that owns the "
        "spacy install; if spacy was installed as root, add USER root before this step "
        "and restore the runtime user after it.\n"
    )
PY

# An unexpected traceback must not take the build down either.
if [ $? -ne 0 ]; then
  echo "WARNING: spacy test-fixture strip did not complete; the image still carries it" >&2
fi

exit 0
