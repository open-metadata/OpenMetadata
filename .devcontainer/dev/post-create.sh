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

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Setting up OpenMetadata Development Environment ==="

cd "$REPO_ROOT"

# Ensure ANTLR4 is available
echo "Setting up ANTLR4..."
# Ensure user-local binaries are available for this script and child processes.
export PATH="$HOME/.local/bin:$PATH"

ANTLR_VERSION=4.9.2
ANTLR_JAR_DIR="$HOME/.local/lib"
ANTLR_JAR_PATH="$ANTLR_JAR_DIR/antlr-${ANTLR_VERSION}-complete.jar"
ANTLR_BIN_PATH="$HOME/.local/bin/antlr4"

CURRENT_ANTLR_VERSION=""
if command -v antlr4 &> /dev/null; then
  CURRENT_ANTLR_VERSION="$(antlr4 -version 2>&1 | awk '{print $NF}')"
fi

if [ "$CURRENT_ANTLR_VERSION" != "$ANTLR_VERSION" ]; then
  if ! command -v java &> /dev/null; then
    echo "ERROR: Java runtime is required to run ANTLR."
    exit 1
  fi

  mkdir -p "$HOME/.local/bin" "$ANTLR_JAR_DIR"
  curl -fsSL "https://www.antlr.org/download/antlr-${ANTLR_VERSION}-complete.jar" -o "$ANTLR_JAR_PATH"

  cat > "$ANTLR_BIN_PATH" <<'EOF'
#!/usr/bin/env bash
set -e
exec java -jar "$HOME/.local/lib/antlr-4.9.2-complete.jar" "$@"
EOF

  chmod 755 "$ANTLR_BIN_PATH"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd openmetadata-ui/src/main/resources/ui
yarn install --frozen-lockfile
cd -

# Set up Python virtual environment for ingestion
echo "Setting up Python ingestion environment..."
if command -v python3 &> /dev/null; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python &> /dev/null; then
  PYTHON_BIN="$(command -v python)"
else
  echo "ERROR: Python is required but was not found in PATH."
  exit 1
fi

echo "Running python version: $($PYTHON_BIN --version)"

# Always use a dedicated venv in the devcontainer to avoid overwriting the host .venv
# (which is volume-mounted and likely contains platform-incompatible binaries).
VENV_DIR=".venv-devcontainer"

"$PYTHON_BIN" -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip

# Run Make targets from repo root to ensure scripts/ and ingestion/ paths resolve correctly
make install_dev generate

# Verify prerequisites
echo "Verifying prerequisites..."
make prerequisites

echo "=== Development environment ready ==="
echo ""
echo "Quick start commands:"
echo "  Backend:   mvn clean package -DskipTests"
echo "  Frontend:  cd openmetadata-ui/src/main/resources/ui && yarn start"
echo "  Ingestion: source $VENV_DIR/bin/activate && cd ingestion"
echo "  Format:    mvn spotless:apply (Java) | yarn lint:fix (Frontend)"
