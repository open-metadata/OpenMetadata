#!/bin/bash
# Copyright 2025 Collate.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ESLint wrapper script for lint-staged pre-commit hooks
#
# This script is required because ESLint 9.x has compatibility issues when run directly
# from lint-staged configuration. It addresses the following problems:
#
# 1. PATH Resolution: lint-staged doesn't have access to node_modules/.bin in PATH,
#    so we use the explicit path to the locally installed ESLint binary
#
# 2. Environment Variables: ESLint 9.x defaults to flat config (eslint.config.js)
#    but this project uses legacy .eslintrc.yaml format. The ESLINT_USE_FLAT_CONFIG=false
#    environment variable forces ESLint to use the legacy configuration system
#
# 3. js-yaml Compatibility: ESLint 9.38.0 is compatible with js-yaml 4.x which
#    removed the deprecated yaml.safeLoad function that was causing cherry-pick errors

# Force ESLint to use legacy .eslintrc.yaml instead of flat config
export ESLINT_USE_FLAT_CONFIG=false

# Run ESLint with auto-fix on staged files passed by lint-staged
# The "$@" passes all command-line arguments (staged file paths) to ESLint
./node_modules/.bin/eslint --fix "$@"