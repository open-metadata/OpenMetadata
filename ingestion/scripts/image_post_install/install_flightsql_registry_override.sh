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

set -euo pipefail

EXPECTED_WRAPPER_VERSION="1.12.0"
REGISTRY_DRIVER_VERSION="1.12.1"
PYTHON="${IMAGE_POST_INSTALL_PYTHON:-$(command -v python || command -v python3 || true)}"

if [ -z "${PYTHON}" ]; then
  echo "ERROR: no python interpreter on PATH; cannot inspect adbc-driver-flightsql" >&2
  exit 1
fi

WRAPPER_VERSION="$("${PYTHON}" - <<'PY'
from importlib.metadata import PackageNotFoundError, version

try:
    print(version("adbc-driver-flightsql"))
except PackageNotFoundError:
    print("")
PY
)"

if [ -z "${WRAPPER_VERSION}" ]; then
  echo "adbc-driver-flightsql not installed; registry override not required"
  exit 0
fi

if [ "${WRAPPER_VERSION}" != "${EXPECTED_WRAPPER_VERSION}" ]; then
  echo "ERROR: expected adbc-driver-flightsql ${EXPECTED_WRAPPER_VERSION}, found ${WRAPPER_VERSION}" >&2
  echo "Inspect the new wheel, set a safe dependency floor, and remove this temporary override." >&2
  exit 1
fi

REGISTRY_DIR="$(mktemp -d)"
trap 'rm -rf "${REGISTRY_DIR}"' EXIT
export ADBC_DRIVER_PATH="${REGISTRY_DIR}/drivers"

"${PYTHON}" -m pip install --quiet "dbc==0.3.0"
DBC_BIN="$(command -v dbc || true)"
if [ -z "${DBC_BIN}" ]; then
  echo "ERROR: dbc==0.3.0 installed without placing dbc on PATH" >&2
  exit 1
fi

"${DBC_BIN}" install "flightsql=${REGISTRY_DRIVER_VERSION}"

mapfile -t REGISTRY_LIBRARIES < <(
  find "${ADBC_DRIVER_PATH}" -type f -name 'libadbc_driver_flightsql.so' -print
)
if [ "${#REGISTRY_LIBRARIES[@]}" -ne 1 ]; then
  echo "ERROR: expected one Linux FlightSQL registry library, found ${#REGISTRY_LIBRARIES[@]}" >&2
  exit 1
fi

export ADBC_FLIGHTSQL_LIBRARY="${REGISTRY_LIBRARIES[0]}"
"${PYTHON}" -m pip install \
  --force-reinstall \
  --no-deps \
  --no-binary=adbc-driver-flightsql \
  "adbc-driver-flightsql==${EXPECTED_WRAPPER_VERSION}"

"${PYTHON}" - "${ADBC_FLIGHTSQL_LIBRARY}" <<'PY'
import hashlib
import sys
from pathlib import Path

import adbc_driver_flightsql


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


registry_library = Path(sys.argv[1])
wrapper_library = Path(adbc_driver_flightsql._driver_path())
if digest(registry_library) != digest(wrapper_library):
    raise SystemExit(
        f"FlightSQL wrapper contains {wrapper_library}, not registry artifact "
        f"{registry_library}"
    )

database = adbc_driver_flightsql.connect("grpc://127.0.0.1:1")
database.close()
print(
    f"adbc-driver-flightsql {adbc_driver_flightsql.__version__} uses "
    f"registry driver {registry_library.name} {digest(wrapper_library)}"
)
PY

"${PYTHON}" -m pip uninstall --quiet --yes dbc
rm -rf "${REGISTRY_DIR}"
trap - EXIT
