#!/bin/bash

set -euo pipefail
while ! curl --http0.9 -o - localhost:3306; do sleep 5; done
mv /openmetadata.yaml /openmetadata-*/conf/openmetadata.yaml
cd /openmetadata-*/
./bootstrap/bootstrap_storage.sh migrate
./bin/openmetadata-server-start.sh conf/openmetadata.yaml