#!/bin/bash
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

cd "$(dirname "${BASH_SOURCE[0]}")" || exit

unset OM_EXTRA_COMPOSE_FILES
unset OM_ADDITIONAL_UP_SERVICES
unset STRICT_DAG_VALIDATION
export RDF_ENABLED=false
export RDF_AUTO_REINDEX=false
unset RDF_STORAGE_TYPE
unset RDF_ENDPOINT
unset RDF_REMOTE_USERNAME
unset RDF_REMOTE_PASSWORD
unset RDF_BASE_URI
unset RDF_DATASET
unset VALIDATE_COMPOSE_MAX_RETRIES
unset VALIDATE_COMPOSE_DAG_RUN_RETRIES
unset VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS
unset VALIDATE_COMPOSE_DAG_RUN_POLL_SECONDS
export VALIDATION_TIMEOUT_SECONDS="${VALIDATION_TIMEOUT_SECONDS:-300}"
export APP_RUN_WAIT_TIMEOUT_SECONDS="${APP_RUN_WAIT_TIMEOUT_SECONDS:-300}"

source ./run_local_docker_common.sh

run_local_docker_main "$@"
