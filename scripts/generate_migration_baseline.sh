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
# Regenerates the consolidated migration baseline for both dialects from the pinned revision that
# still contains the complete Flyway + native pre-2.0 chain. Requires Docker, Java 21, and Maven.

set -euo pipefail

readonly REFERENCE_REVISION="b07117a765466d3fd12c3179ac800bc734de0a5f"
readonly WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly GENERATOR_PACKAGE="openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/migration"
readonly REFERENCE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openmetadata-baseline-reference.XXXXXX")"
readonly REFERENCE_MAVEN_REPO="$REFERENCE_ROOT/.m2"

cleanup() {
  rm -rf -- "$REFERENCE_ROOT"
}
trap cleanup EXIT

cd "$WORKSPACE_ROOT"
git cat-file -e "${REFERENCE_REVISION}^{commit}"
git -C "$REFERENCE_ROOT" init --quiet
git -C "$REFERENCE_ROOT" fetch --quiet --depth=1 "$WORKSPACE_ROOT" "$REFERENCE_REVISION"
git -C "$REFERENCE_ROOT" checkout --quiet --detach FETCH_HEAD

mkdir -p "$REFERENCE_ROOT/$GENERATOR_PACKAGE"
for helper in BaselineGeneratorHarness.java BaselineScratchSupport.java BaselineArtifactWriter.java; do
  cp "$WORKSPACE_ROOT/$GENERATOR_PACKAGE/$helper" "$REFERENCE_ROOT/$GENERATOR_PACKAGE/$helper"
done

echo "==> Building pinned migration runtime ($REFERENCE_REVISION)"
(
  cd "$REFERENCE_ROOT"
  mvn -Dmaven.repo.local="$REFERENCE_MAVEN_REPO" -DskipTests \
    -pl openmetadata-integration-tests -am install
)

echo "==> Generating PostgreSQL baseline (bootstrap/sql/migrations/baseline/postgres/)"
(
  cd "$REFERENCE_ROOT"
  mvn -Dmaven.repo.local="$REFERENCE_MAVEN_REPO" test -pl openmetadata-integration-tests \
    -Dtest=BaselineGeneratorHarness -Dbaseline.generate=true -DfailIfNoTests=false \
    -Dbaseline.referenceRevision="$REFERENCE_REVISION" \
    -Dbaseline.outputRoot="$WORKSPACE_ROOT/bootstrap/sql/migrations/baseline"
)

echo "==> Generating MySQL baseline (bootstrap/sql/migrations/baseline/mysql/)"
(
  cd "$REFERENCE_ROOT"
  mvn -Dmaven.repo.local="$REFERENCE_MAVEN_REPO" test -pl openmetadata-integration-tests \
    -Dtest=BaselineGeneratorHarness -Dbaseline.generate=true -DfailIfNoTests=false \
    -Dbaseline.referenceRevision="$REFERENCE_REVISION" \
    -Dbaseline.outputRoot="$WORKSPACE_ROOT/bootstrap/sql/migrations/baseline" \
    -DdatabaseType=mysql
)

echo "==> Done. Review the diff:"
git -c color.ui=always diff --stat -- bootstrap/sql/migrations/baseline || true
echo "==> Verify both dialects before committing:"
echo "    mvn test -pl openmetadata-integration-tests -Dtest=BaselineFreshInstallIT,BaselineCrashResumeIT"
echo "    mvn test -pl openmetadata-integration-tests -Dtest=BaselineFreshInstallIT,BaselineCrashResumeIT -DdatabaseType=mysql"
