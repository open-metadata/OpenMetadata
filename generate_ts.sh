#!/bin/bash

# Copyright 2022 Collate.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Define color codes
BRIGHT_RED='\033[1;31m'
BRIGHT_GREEN='\033[1;32m'
BRIGHT_CYAN='\033[1;36m'
NC='\033[0m' # No Color

# Get the script's base directory (assuming it's inside OpenMetadata repo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENMETADATA_BASE="$(dirname "$SCRIPT_DIR")"  # Adjust if script is placed deeper
UI_RESOURCES_PATH="$OPENMETADATA_BASE/OpenMetadata/openmetadata-ui/src/main/resources/ui"

# Check if a file path is provided
if [[ -z "$1" ]]; then
    echo -e "${BRIGHT_RED}Error: No file path provided. Please pass the file path as an argument.${NC}"
    exit 1
fi

FILE_PATH="$1"

echo -e "${BRIGHT_CYAN}Detected OpenMetadata base path: $OPENMETADATA_BASE${NC}"
echo -e "${BRIGHT_CYAN}Changing directory to OpenMetadata UI resources...${NC}"

# Change to the UI resources directory
cd "$UI_RESOURCES_PATH" || { 
    echo -e "${BRIGHT_RED}Failed to change directory to OpenMetadata UI resources.${NC}"; 
    exit 1
}

echo -e "${BRIGHT_CYAN}Running 'sh json2ts.sh $FILE_PATH'...${NC}"

# Run the json2ts.sh script with the given file path
sh json2ts.sh "$FILE_PATH"
if [[ $? -eq 0 ]]; then
    echo -e "${BRIGHT_GREEN}'json2ts.sh' executed successfully.${NC}"
else
    echo -e "${BRIGHT_RED}Error during 'json2ts.sh' execution.${NC}"
    exit 1
fi

# Revert back to the original directory
cd - > /dev/null || { 
    echo -e "${BRIGHT_RED}Failed to revert to the original directory.${NC}"; 
    exit 1
}

echo -e "${BRIGHT_CYAN}Reverted to the original directory.${NC}"
