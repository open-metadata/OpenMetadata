#!/usr/bin/env bash
# bash strict mode
set -eup pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
EXCLUDED_DIRS=".vscode|great_expectations/resources"
echo "Validating JSON files..."
git ls-files | grep "\.json$" | grep -vE "/($EXCLUDED_DIRS)/" | while read file; do jq . "$file" >/dev/null 2>&1 || { echo "Invalid JSON in $file"; exit 1; }; done
echo "Validating YAML files..."
git ls-files | grep -E "\.ya?ml$" | grep -vE "/($EXCLUDED_DIRS)/" | while read file; do python ${SCRIPT_DIR}/validate_yaml.py "$file" >/dev/null 2>&1 || { echo "Invalid YAML in $file"; exit 1; }; done
