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

set -eu

set +e
declare -A test_map
res=$?
if [[ $res -ne 0 ]]; then
  echo "✗ ERROR: declare -A is not supported. Do you have bash version 4.0 or higher installed?"
  exit 2
fi
set -e


# --- Dependency Definitions ---
declare -A python=( ["name"]="Python" ["version_command"]="python --version 2>&1 | awk '{print \$2}'" ["required_version"]="3.11 3.12 3.13" )
declare -A docker=( ["name"]="Docker" ["version_command"]="docker --version | awk '{print \$3}' | sed 's/,//'" ["required_version"]="20 21 22 23 24 25 26 27 28 29" )
declare -A maven=( ["name"]="Maven" ["version_command"]="mvn --version | head -n1 | awk '{print \$3}'" ["required_version"]="3.6 3.7 3.8 3.9" )
declare -A java=( ["name"]="Java" ["version_command"]="java -version 2>&1 | awk -F'\"' '/version/ {print \$2}'" ["required_version"]="21" )
declare -A jq=( ["name"]="jq" ["version_command"]="jq --version | awk -F- '{print \$2}'" ["required_version"]="any" )
declare -A node=( ["name"]="Node" ["version_command"]="node --version" ["required_version"]="22" )
declare -A yarn=( ["name"]="Yarn" ["version_command"]="yarn --version" ["required_version"]="1.22 1.23 1.24" )
declare -A antlr=( ["name"]="ANTLR" ["version_command"]="antlr4 | head -n1 | awk 'NF>1{print \$NF}'" ["required_version"]="4.9" )

code=0

function print_error() {
    >&2 echo "✗ ERROR: $1"
}

# 2. Fixed: Use return codes instead of subshell echos
check_command_existence() {
    local cmd_to_check=$1
    if ! command -v "$cmd_to_check" >/dev/null 2>&1; then
      print_error "$cmd_to_check is not installed."
      code=2
      return 1
    fi
    return 0
}

# 3. Fixed: Corrected variable references (was using global $version incorrectly)
check_version() {
    local tool_name=$1
    local current=$2
    local required=$3
    
    if [[ "$required" == "any" ]]; then
        echo "✓ $tool_name version $current is supported."
        return
    fi

    IFS=' ' read -r -a required_versions <<< "$required"
    for v in "${required_versions[@]}"; do
        if [[ "$current" =~ ^$v.* ]]; then
            echo "✓ $tool_name version $current is supported."
            return
        fi
    done

    print_error "$tool_name version $current is not supported. Supported versions are: $required"
    code=1
}

# --- Main Execution ---
for dep_key in python docker java maven jq node yarn antlr; do
    # Use nameref to access the associative arrays defined above
    declare -n dependency=$dep_key
    
    # Extract the base command (e.g., 'python' from the full version command)
    cmd_name=$(echo "${dependency["version_command"]}" | awk '{print $1}')
    
    # Call function directly (No subshell) so 'code' updates globally
    if ! check_command_existence "$cmd_name"; then
        continue
    fi
    
    tool_name=${dependency["name"]}
    version=$(eval "${dependency["version_command"]}")
    req_ver=${dependency["required_version"]}
    
    check_version "$tool_name" "$version" "$req_ver"
done

echo "---"
if [[ $code -eq 0 ]]; then
    echo "✓ All prerequisites are met."
else
    print_error "Some prerequisites are not met."
fi

exit $code
