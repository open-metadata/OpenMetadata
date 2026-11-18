#!/usr/bin/env bash
set -eo pipefail
# shellcheck source=/dev/null
source env/bin/activate
site_packages_path="$(python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())))")"
SITE_CUSTOMIZE_PATH="${site_packages_path}/sitecustomize.py"
export SITE_CUSTOMIZE_PATH
{
  echo "import os"
  echo "try:"
  echo "    import coverage"
  echo "    os.environ['COVERAGE_PROCESS_START'] = os.path.join(os.environ.get('GITHUB_WORKSPACE', os.getcwd()), 'ingestion', 'pyproject.toml')"
  echo "    coverage.process_startup()"
  echo "except ImportError:"
  echo "    pass"
} >> "$SITE_CUSTOMIZE_PATH"
set +e
coverage run --rcfile ingestion/pyproject.toml --branch -m pytest -c ingestion/pyproject.toml "--junitxml=ingestion/junit/test-results-${E2E_TEST}.xml" --ignore=ingestion/tests/unit/source "ingestion/tests/cli_e2e/test_cli_${E2E_TEST}.py" 2>&1 | tee ingestion/cli-e2e-test-run.log
test_exit_code=${PIPESTATUS[0]}
echo "$test_exit_code" > ingestion/cli-e2e-test-exit-code.txt
set -e
coverage combine "--data-file=.coverage.${E2E_TEST}" --rcfile=ingestion/pyproject.toml --keep .coverage* || true
coverage report --rcfile ingestion/pyproject.toml "--data-file=.coverage.${E2E_TEST}" || true
exit "$test_exit_code"
