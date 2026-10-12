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

LIBRARY=/tmp/libadbc_driver_flightsql.so

case "${1:-}" in
  build)
    # The 1.12.0 wheel bundles a Go 1.26.5 / gRPC 1.82.1 library. Rebuild the
    # same ADBC release so the Python API and native driver stay in sync.
    curl -fsSL --retry 3 \
      https://codeload.github.com/apache/arrow-adbc/tar.gz/refs/tags/apache-arrow-adbc-24 \
      -o /tmp/arrow-adbc-24.tar.gz
    echo "47c6d2eb6686e838941d48f9527e94838c4b714a76c6bcdc93c1bdfcd24b3ccc  /tmp/arrow-adbc-24.tar.gz" | sha256sum -c -
    mkdir -p /tmp/arrow-adbc
    tar -xzf /tmp/arrow-adbc-24.tar.gz -C /tmp/arrow-adbc --strip-components=1
    cd /tmp/arrow-adbc/go/adbc
    go get google.golang.org/grpc@v1.83.2 golang.org/x/text@v0.41.0
    go get golang.org/x/net@v0.60.0
    go build -buildvcs=false -trimpath -tags driverlib -buildmode=c-shared \
      -ldflags "-s -w -X github.com/apache/arrow-adbc/go/adbc/driver/internal/driverbase.infoDriverVersion=1.12.0" \
      -o "$LIBRARY" ./pkg/flightsql
    go version -m "$LIBRARY" | grep -E 'go1.26.9|golang.org/x/(net|text)|google.golang.org/grpc'
    ;;
  install)
    python - "$LIBRARY" <<'PY'
import ctypes
import importlib.metadata
import importlib.util
import pathlib
import shutil
import sys

spec = importlib.util.find_spec("adbc_driver_flightsql")
if spec is not None:
    version = importlib.metadata.version("adbc-driver-flightsql")
    if version != "1.12.0":
        raise RuntimeError(f"patched Flight SQL library requires adbc-driver-flightsql 1.12.0, found {version}")
    target = pathlib.Path(spec.origin).parent / "libadbc_driver_flightsql.so"
    shutil.copyfile(sys.argv[1], target)
    ctypes.CDLL(str(target))
    print(f"Installed patched Flight SQL library in {target}")
else:
    print("Flight SQL extra is not installed; skipping native library replacement")
PY
    rm -f "$LIBRARY"
    ;;
  *)
    echo "usage: $0 {build|install}" >&2
    exit 2
    ;;
esac
