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


declare -A python
python["name"]="Python"
python["version_command"]="python --version 2>&1 | awk '{print \$2}'"
python["required_version"]="3.9 3.10 3.11"

declare -A docker
docker["name"]="Docker"
docker["version_command"]="docker --version | awk '{print \$3}' | sed 's/,//'"
docker["required_version"]="20 21 22 23 24 25 26 27 28 29"

declare -A maven
maven["name"]="Maven"
maven["version_command"]="mvn --version | head -n1 | awk '{print \$3}'"
maven["required_version"]="3.6 3.7 3.8 3.9"

declare -A java
java["name"]="Java"
java["version_command"]="java -version 2>&1 | awk -F'\"' '/version/ {print \$2}'"
java["required_version"]="21"

declare -A jq
jq["name"]="jq"
jq["version_command"]="jq --version | awk -F- '{print \$2}'"
jq["required_version"]="any"

declare -A node
node["name"]="Node"
node["version_command"]="node --version"
node["required_version"]="18"

declare -A yarn
yarn["name"]="Yarn"
yarn["version_command"]="yarn --version"
yarn["required_version"]="1.22 1.23 1.24"

declare -A antlr
antlr["name"]="ANTLR"
antlr["version_command"]="antlr4 | head -n1 | awk 'NF>1{print \$NF}'"
antlr["required_version"]="4.9"


code=0

function print_error() {
    >&2 echo "✗ ERROR: $1"
}

check_command_existence() {
    which "$1" >/dev/null 2>&1
    res=$?
    if [[ $res -ne 0 ]]; then
      print_error "$command is not installed."
      code=2
    fi
    echo $res
}

check_version() {
    local tool_name=$1
    local current=$2
    local required=$3
    IFS=' ' read -r -a required_versions <<< "$required"
    if [[ "$required" == "any" ]]; then
        echo "✓ $tool_name version $current is supported."
        return
    fi
    for v in "${required_versions[@]}"; do
        if [[ "$current" =~ $v.* ]]; then
            echo "✓ $tool_name version $version is supported."
            return
        fi
    done
    print_error "$tool_name version $version is not supported. Supported versions are: $required"
    code=1
}

declare -n dependency
for dependency in python docker java maven jq node yarn antlr; do
    command=$(echo "${dependency["version_command"]}" | awk '{print $1}')
    if [[ $(check_command_existence "$command") -ne 0 ]]; then
        continue
    fi
    tool_name=${dependency["name"]}
    version=$(eval ${dependency["version_command"]})
    required_version=${dependency["required_version"]}
    check_version $tool_name "$version" "$required_version"
done
if [[ $code -eq 0 ]]; then
    echo "✓ All prerequisites are met."
else
    print_error "Some prerequisites are not met."
fi
exit $code
