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

# Drop the teradatasql driver libraries this image's platform can never load.
#
# teradatasql ships every platform it supports inside one wheel: seven Linux/AIX
# .so variants, a Windows .dll pair and a macOS .dylib -- 337 MB, of which
# exactly one file is ever dlopen()ed. All ten are Go shared libraries, so a
# scanner reports the whole go/stdlib CVE set once per file against every image
# carrying the teradata extra (CVE-2026-39821 Critical, plus CVE-2026-33818,
# CVE-2026-46600, CVE-2026-56853, CVE-2026-56859, CVE-2026-56862 High and
# CVE-2026-56858 Medium).
#
# This does not fix those CVEs. teradatasql 20.0.0.65 is the newest release on
# PyPI and is built with go1.26.5; the fix is go1.26.6 and there is nothing to
# upgrade to until Teradata rebuilds. What this does is cut the flagged
# artifacts from ten to two and the package from 337 MB to 48 MB on arm64 or
# 70 MB on amd64 -- both measured, the two differ because the x86 libraries are
# larger -- so the remaining exposure is the code actually loadable on this image.
#
# Two files are kept, not one: teradatasql selects the `fips` variant when the
# host kernel reports /proc/sys/crypto/fips_enabled == 1. That is a property of
# the node the container lands on, not of the build, so dropping it would turn a
# FIPS-enabled node into a failure at connect() time.
#
# Run this after the final pip install of any image shipping the teradata extra;
# a later install that replaces the teradatasql tree restores all ten files.
#
# Unlike the spaCy fixture strip next door, deleting the wrong file here would
# break the driver at runtime. So nothing is removed until the library this
# platform actually loads has been found on disk and successfully dlopen()ed --
# if that cannot be established the directory is left exactly as it is. The FIPS
# variant is kept but never test-loaded; see primary_keeper_is_loadable below for
# why testing it would risk skipping the strip for no safety gain. Every path
# still exits 0: the cost of skipping is image size and scanner noise, never a
# failed build.

set -uo pipefail

# `python` first, not `python3`, for the same reason as the spaCy strip: pip
# installs into whichever interpreter `python` resolves to in these images (in
# the airflow base that is ~/.local/bin/python, not the system one), so
# preferring `python3` could scan a different site-packages than the one the
# driver was installed into.
PYTHON="$(command -v python || command -v python3 || true)"
if [ -z "${PYTHON}" ]; then
  echo "WARNING: no python interpreter on PATH; skipping teradatasql arch-lib strip" >&2
  exit 0
fi

"${PYTHON}" - <<'PY'
import ctypes
import os
import platform
import sys

# Every variant the wheel ships. Deletion is restricted to this list rather than
# globbing teradatasql.*, so a variant added by a future release is left in place
# (one extra finding) instead of being removed on a guess (a broken driver).
ALL_VARIANTS = (
    "so",
    "fips.so",
    "x86.so",
    "arm.so",
    "arm.fips.so",
    "power.so",
    "aix.so",
    "dll",
    "x86.dll",
    "dylib",
)


# Branch-for-branch mirror of the selection in teradatasql/__init__.py, in the
# same order -- 32-bit is checked before FIPS there, and ARM before POWER. Keep
# it that way: a diff against the driver's block is what shows this needs
# updating. The FIPS variant is decided at runtime from the host kernel, so both
# candidates for the platform are returned; the non-FIPS one comes first.
def keepers_for_platform():
    os_type = platform.system().lower()
    cpu = platform.machine().lower()
    is_arm = cpu.startswith("arm") or cpu.startswith("aarch")
    is_power = cpu == "ppc64le"
    bits = ctypes.sizeof(ctypes.c_voidp) * 8

    if os_type == "windows":
        return ["x86.dll"] if bits == 32 else ["dll"]
    if os_type == "darwin":
        return ["dylib"]
    if os_type == "aix":
        return ["aix.so"]
    if is_arm:
        return ["arm.so", "arm.fips.so"]
    if is_power:
        return ["power.so"]
    if bits == 32:
        return ["x86.so"]
    return ["so", "fips.so"]


# Walk every sys.path entry rather than resolving the package once via find_spec:
# a user-site install shadows a system-site one, so find_spec reports only the
# shadowing copy and the other stays on disk -- where the scanner still reads it.
def teradatasql_dirs():
    seen, found = set(), []
    for entry in sys.path:
        if not entry:
            continue
        pkg_dir = os.path.join(entry, "teradatasql")
        key = os.path.realpath(pkg_dir)
        if key not in seen and os.path.isdir(pkg_dir):
            seen.add(key)
            found.append(pkg_dir)
    return found


def variant_path(pkg_dir, variant):
    return os.path.join(pkg_dir, "teradatasql." + variant)


# The safety gate, and it deliberately tests only the non-FIPS keeper. dlopen is
# what the driver itself does at connect() time, so a library that loads here is
# one the driver can use; anything short of that (file absent, wrong ELF arch,
# missing dependency) means we do not understand this install well enough to
# delete from it.
#
# The FIPS variant is NOT loaded, for two reasons. It is only ever selected on a
# host whose kernel reports fips_enabled=1, which a build machine is not, so a
# load here proves nothing about the environment that will actually use it. And
# it is a second Go c-shared object: dlopening it alongside the non-FIPS runtime
# initialises a second Go runtime in the same process, which can fail -- or abort
# the interpreter -- for reasons that say nothing about whether the file is good.
# Either way the strip would be skipped, leaving the full 337 MB tree in place
# with nothing but a stderr warning. It is never deleted regardless, because it is
# in `keepers` and the delete loop skips those, so not testing it costs no safety.
def primary_keeper_is_loadable(pkg_dir, primary):
    path = variant_path(pkg_dir, primary)
    if not os.path.isfile(path):
        sys.stderr.write(f"WARNING: {path} is missing; leaving {pkg_dir} untouched\n")
        return False
    try:
        ctypes.cdll.LoadLibrary(path)
    except OSError as exc:
        sys.stderr.write(
            f"WARNING: {path} failed to load ({exc}); leaving {pkg_dir} untouched\n"
        )
        return False
    return True


pkg_dirs = teradatasql_dirs()
if not pkg_dirs:
    print("teradatasql not installed; nothing to strip")
    raise SystemExit(0)

keepers = keepers_for_platform()
print(
    f"platform {platform.system().lower()}/{platform.machine().lower()} "
    f"({ctypes.sizeof(ctypes.c_voidp) * 8}-bit) keeps: "
    f"{', '.join('teradatasql.' + k for k in keepers)}",
    flush=True,
)

for pkg_dir in pkg_dirs:
    if not primary_keeper_is_loadable(pkg_dir, keepers[0]):
        continue

    removed, freed = [], 0
    for variant in ALL_VARIANTS:
        if variant in keepers:
            continue
        path = variant_path(pkg_dir, variant)
        if not os.path.isfile(path):
            continue
        size = os.path.getsize(path)
        try:
            os.remove(path)
        except OSError as exc:
            # Non-fatal by design: the keepers were verified before anything was
            # touched, so a blocked delete costs image size and scanner noise
            # while leaving a working driver behind.
            sys.stderr.write(f"WARNING: could not remove {path}: {exc}\n")
            sys.stderr.write(
                "This layer must run as the user that owns the teradatasql "
                "install; if it was installed as root, add USER root before "
                "this step and restore the runtime user after it.\n"
            )
            continue
        removed.append(variant)
        freed += size

    # flush: stdout is block-buffered when the build pipes it, so without this
    # the summary lands after any stderr warning and the log reads back-to-front.
    print(
        f"stripped {len(removed)} unloadable teradatasql librar(y/ies) "
        f"({freed // (1024 * 1024)} MB) from {pkg_dir}",
        flush=True,
    )
PY

# An unexpected traceback must not take the build down either.
if [ $? -ne 0 ]; then
  echo "WARNING: teradatasql arch-lib strip did not complete; the image still carries every variant" >&2
fi

exit 0
