#!/bin/bash
#
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
#

# Script configuration
readonly SCHEMA_DIRECTORY='openmetadata-spec/src/main/resources/json/schema/'
readonly UI_OUTPUT_DIRECTORY='openmetadata-ui/src/main/resources/ui/src/generated'
readonly MAX_PARALLEL_JOBS=35
readonly TEMP_DIR=$(mktemp -d)

# Default value for add_licensing flag
ADD_LICENSING=false

# Parse command line arguments
while getopts "l:" opt; do
  case $opt in
    l)
      if [[ "${OPTARG}" == "true" ]]; then
        ADD_LICENSING=true
      fi
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

addLicensing(){
    dir=$1
    current_year=$(date +%Y)
    # First read and modify the license text with current year
    modified_license=$(sed "s/Copyright [0-9]\{4\}/Copyright ${current_year}/" openmetadata-ui/src/main/resources/ui/types-licensing.txt)
    # Combine modified license with file content, adding a newline in between
    echo "${modified_license}
$(cat "$dir")" > "$dir"
}

# Function to modify schema file by updating $id field
# Args:
#   $1 - Input schema file path
#   $2 - Output temporary schema file path
generate_temp_schema() {
    local input_schema="$1"
    local output_schema="$2"
    
    if [[ ! -f "$input_schema" ]]; then
        echo "Error: Input schema file not found: $input_schema"
        return 1
    fi
    
    jq '(."$id" |= sub("https://open-metadata.org/schema";"";"i"))' "$input_schema" > "$output_schema"
}

# Function to generate TypeScript types from JSON schema
# Args:
#   $1 - Input temporary schema file
#   $2 - Output TypeScript file path
generate_typescript() {
    local input_schema="$1"
    local output_file="$2"
    
    echo "Generating ${output_file} from specification at ${input_schema}"
    ./node_modules/.bin/quicktype -s schema "$input_schema" -o "$output_file" --just-types > /dev/null 2>&1

    # Remove empty output files
    if [[ ! -s "$output_file" ]]; then
        rm -f "$output_file"
    else
        # Only add licensing if the flag is true
        if [[ "$ADD_LICENSING" == "true" ]]; then
            addLicensing "$output_file"
        fi
    fi
}

# Main function to process all schema files and generate TypeScript types
process_schema_files() {
    # Clean existing output directory
    if [[ -d "$UI_OUTPUT_DIRECTORY" ]]; then
        rm -r "$UI_OUTPUT_DIRECTORY"
    fi
    
    # First pass: Create temporary schema files
    echo "Creating temporary schema files..."
    for file_path in $(find "$SCHEMA_DIRECTORY" -name "*.json" | sed -e "s|$SCHEMA_DIRECTORY||g"); do
        local temp_dir="$TEMP_DIR/$(dirname "$file_path")"
        mkdir -p "$temp_dir"
        local temp_schema_file="${temp_dir}/$(basename -- "$file_path")"
        generate_temp_schema "$PWD/$SCHEMA_DIRECTORY$file_path" "$temp_schema_file"
    done

    # Second pass: Generate TypeScript files
    echo "Generating TypeScript files..."
    local escaped_temp_dir=$(echo "$TEMP_DIR" | sed -e 's/[]\/$*.^[]/\\&/g')
    for file_path in $(find "$TEMP_DIR" -name "*.json" | sed -e "s|${escaped_temp_dir}||g"); do
        # Wait if we have too many parallel jobs
        while [[ $(jobs | wc -l) -ge $MAX_PARALLEL_JOBS ]]; do
            sleep 1
        done

        # Prepare output directory and file paths
        mkdir -p "$(dirname "$UI_OUTPUT_DIRECTORY$file_path")"
        local typescript_file=$(echo "$file_path" | sed "s/.json/.ts/g")
        local output_typescript="$PWD/$UI_OUTPUT_DIRECTORY$typescript_file"
        local input_schema="$TEMP_DIR$file_path"

        # Generate TypeScript in background
        generate_typescript "$input_schema" "$output_typescript" &
    done
}

# Main execution
echo "Starting JSON Schema to TypeScript conversion..."
cd "$(dirname "$0")/../../../../.." || {
    echo "Error: Failed to change to root directory"
    exit 1
}

process_schema_files
wait $(jobs -p)

# Cleanup
rm -rf "$TEMP_DIR"
echo "Conversion completed successfully!"