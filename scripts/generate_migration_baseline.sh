#!/usr/bin/env bash
#
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
#
# Regenerates the consolidated migration baseline under bootstrap/sql/migrations/baseline/
# for BOTH dialects by chain-installing every pre-2.0 migration into scratch databases and
# dumping the result. Requires Docker (testcontainers) and a full local Maven build.
#
# After regenerating: review the diff, then prove fidelity with the equivalence check:
#   mvn test -pl openmetadata-integration-tests -Dtest=BaselineEquivalenceIT
#   mvn test -pl openmetadata-integration-tests -Dtest=BaselineEquivalenceIT -DdatabaseType=mysql

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Generating PostgreSQL baseline (bootstrap/sql/migrations/baseline/postgres/)"
mvn test -pl openmetadata-integration-tests \
  -Dtest=BaselineGeneratorHarness -Dbaseline.generate=true -DfailIfNoTests=false

echo "==> Generating MySQL baseline (bootstrap/sql/migrations/baseline/mysql/)"
mvn test -pl openmetadata-integration-tests \
  -Dtest=BaselineGeneratorHarness -Dbaseline.generate=true -DfailIfNoTests=false \
  -DdatabaseType=mysql

echo "==> Done. Review the diff:"
git -c color.ui=always diff --stat -- bootstrap/sql/migrations/baseline || true
echo "==> Now run BaselineEquivalenceIT for both dialects before committing."
