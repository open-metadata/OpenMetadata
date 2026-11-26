#!/usr/bin/env bash
set -euo pipefail

python .github/scripts/check_pr_workflow_security.py
python -m pytest -q \
  .github/scripts/tests/test_pr_workflow_security.py \
  .github/scripts/tests/test_ci_speed_*.py \
  .github/scripts/tests/test_summarize_surefire.py \
  .github/scripts/tests/test_prune_ghcr_package.py \
  .github/scripts/tests/test_validate_json_yaml.py
./scripts/validate_json_yaml.sh
