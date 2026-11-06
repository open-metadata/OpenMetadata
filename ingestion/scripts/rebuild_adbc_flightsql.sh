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

# Rebuild the Go library inside the adbc-driver-flightsql wheel with newer Go
# module versions, and swap it into the image.
#
# The iomete extra pulls in adbc-driver-flightsql, whose wheel bundles
# libadbc_driver_flightsql.so: a Go c-shared library compiled by Apache's release
# CI. Its Go dependencies are fixed at build time and no Python metadata names
# them, so pip can never upgrade them. 1.13.0, the newest release, embeds
# klauspost/compress v1.20.0 and golang.org/x/net v0.61.0, and upstream main
# still pins the same versions.
#
#   build <out-dir>    run in a golang:<ver>-bookworm stage; cross-compiles for
#                      $TARGETARCH with upstream's flags plus GO_MODULE_UPGRADES.
#   install <so-dir>   run after the final pip install; replaces the wheel's
#                      library only when the installed wrapper is ADBC_VERSION.
#
# Remove this script and its Dockerfile stages once an adbc-driver-flightsql
# release embeds module versions at or above GO_MODULE_UPGRADES; the build
# fails once the pinned ADBC source already requires them.

set -euo pipefail

ADBC_VERSION="1.13.0"
GO_MODULE_UPGRADES="github.com/klauspost/compress@v1.20.3 golang.org/x/net@v0.62.0"
LIB="libadbc_driver_flightsql.so"

build() {
  local out="$1" cc
  case "${TARGETARCH:?TARGETARCH is set by buildx}" in
    amd64) cc=x86_64-linux-gnu-gcc ;;
    arm64) cc=aarch64-linux-gnu-gcc ;;
    *) echo "unsupported TARGETARCH ${TARGETARCH}" >&2; exit 1 ;;
  esac
  # The bare gcc-<triple> package has no target libc headers; crossbuild-essential does.
  apt-get -qq update
  apt-get -qq install -y --no-install-recommends "crossbuild-essential-${TARGETARCH}"

  git clone -q --depth 1 --branch "go/adbc/v${ADBC_VERSION}" \
    https://github.com/apache/arrow-adbc.git /src
  cd /src/go/driver/flightsql/pkg
  local m mod want have
  # `go get` downgrades when asked for an older version, so a bumped ADBC_VERSION
  # whose source already requires these must not pass silently.
  for m in ${GO_MODULE_UPGRADES}; do
    mod="${m%@*}" want="${m#*@}"
    have="$(go list -m -f '{{.Version}}' "${mod}")"
    if [ "$(printf '%s\n%s\n' "${want}" "${have}" | sort -V | tail -1)" = "${have}" ]; then
      echo "ADBC ${ADBC_VERSION} already requires ${mod} ${have} (>= ${want}); delete this workaround" >&2
      exit 1
    fi
  done
  # shellcheck disable=SC2086
  go get ${GO_MODULE_UPGRADES}

  local major minor
  IFS=. read -r major minor _ <<<"${ADBC_VERSION}"
  mkdir -p "${out}"
  # Mirrors c/cmake_modules/GoUtils.cmake: the version script hides the Go
  # runtime's symbols, which matters when teradatasql's Go library shares the process.
  CGO_ENABLED=1 GOOS=linux GOARCH="${TARGETARCH}" CC="${cc}" GOTOOLCHAIN=local \
    go build -buildvcs=true -tags=driverlib -buildmode=c-shared -o "${out}/${LIB}" \
    -ldflags "-X github.com/apache/arrow-adbc/go/adbc/driver/internal/driverbase.infoDriverVersion=v${ADBC_VERSION} '-extldflags=-Wl,--version-script=/src/c/symbols.map,-soname,${LIB}.$((major * 100 + minor))'" \
    .
  local info
  info="$(go version -m "${out}/${LIB}")"
  for m in ${GO_MODULE_UPGRADES}; do
    mod="${m%@*}" want="${m#*@}"
    grep -qE "^\s+dep\s+${mod}\s+${want}\s" <<<"${info}" \
      || { echo "${LIB} does not embed ${mod} ${want}" >&2; exit 1; }
    echo "${LIB} embeds ${mod} ${want}"
  done
}

install() {
  local src="$1/${LIB}"
  PYTHON="$(command -v python || command -v python3)"
  ADBC_VERSION="${ADBC_VERSION}" SRC="${src}" LIB="${LIB}" "${PYTHON}" - <<'PY'
import importlib.metadata
import os
import shutil
import sys

try:
    installed = importlib.metadata.version("adbc-driver-flightsql")
except importlib.metadata.PackageNotFoundError:
    print("adbc-driver-flightsql not installed; nothing to replace")
    raise SystemExit(0)

wanted = os.environ["ADBC_VERSION"]
if installed != wanted:
    # A different wrapper may expect a different driver build, so leave it alone;
    # the scanner reports whether that release still needs this workaround.
    print(
        f"WARNING: adbc-driver-flightsql {installed} installed, rebuild targets {wanted}; "
        "leaving the wheel's library in place. Bump ADBC_VERSION in "
        "ingestion/scripts/rebuild_adbc_flightsql.sh or delete the workaround.",
        file=sys.stderr,
    )
    raise SystemExit(0)

import adbc_driver_flightsql

target = os.path.join(os.path.dirname(adbc_driver_flightsql.__file__), os.environ["LIB"])
backup = target + ".orig"
shutil.move(target, backup)
shutil.copy2(os.environ["SRC"], target)
os.chmod(target, 0o755)
print(f"replaced {target} with the rebuilt driver", flush=True)
PY

  # Separate process: the swap must be proven by a fresh dlopen of the new file.
  # Port 9 refuses, so a Go-side FlightSQL error proves the library loaded and ran.
  "${PYTHON}" - <<'PY'
import importlib.util
import os

if importlib.util.find_spec("adbc_driver_flightsql") is None:
    raise SystemExit(0)
import adbc_driver_flightsql
import adbc_driver_flightsql.dbapi as dbapi

pkg = os.path.dirname(adbc_driver_flightsql.__file__)
backup = os.path.join(pkg, "libadbc_driver_flightsql.so.orig")
if not os.path.exists(backup):
    raise SystemExit(0)
try:
    with dbapi.connect("grpc://127.0.0.1:9") as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")
except Exception as exc:  # noqa: BLE001
    if "[FlightSQL]" not in str(exc):
        raise SystemExit(f"rebuilt FlightSQL driver failed to load: {exc!r}")
else:
    raise SystemExit("expected a connection error from grpc://127.0.0.1:9")
os.remove(backup)
print("rebuilt FlightSQL driver loads and runs", flush=True)
PY
}

case "${1:-}" in
  build) build "${2:?out dir}" ;;
  install) install "${2:?dir holding ${LIB}}" ;;
  *) echo "usage: $0 build <out-dir> | install <so-dir>" >&2; exit 2 ;;
esac
