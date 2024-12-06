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

#!/bin/bash

schema_directory='openmetadata-spec/src/main/resources/json/schema'
om_ui_directory='openmetadata-ui/src/main/resources/ui/src/generated'


generateType() {
    tmp_schema_file=$1
    output_file=$2
    echo "Generating $output_file from specification at $tmp_schema_file"
    ./node_modules/.bin/quicktype -s schema "$tmp_schema_file" -o "$output_file" --just-types > /dev/null 2>&1
}

processFile() {
    schema_file=$1
    relative_path=${schema_file#"$schema_directory/"} # Extract relative path
    output_dir="$om_ui_directory/$(dirname "$relative_path")"

    # Debugging output
    echo "Processing schema: $schema_file"
    echo "Relative path: $relative_path"
    echo "Output directory: $output_dir"

    mkdir -p "$output_dir" # Ensure output directory exists

    tmp_schema_file="$tmp_dir/$(basename "$schema_file")"
    output_file="$output_dir/$(basename "$schema_file" .json).ts"

    # Generate temporary schema and TypeScript file
    generateType "$schema_file" "$output_file"
}

getTypes() {
    total_files=$#
    current_file=1

    for schema_file in "$@"; do
        echo "Processing file $current_file of $total_files: $schema_file"
        processFile "$schema_file"
        current_file=$((current_file + 1))
    done
}

# Move to project root directory
cd "$(dirname "$0")/../../../../.." || exit

echo "Generating TypeScript from OpenMetadata specifications"

if [ "$#" -eq 0 ]; then
    echo "No schema files specified. Please provide schema file paths."
    exit 1
fi

# Process the schema files passed as arguments
getTypes "$@"

echo "TypeScript generation completed."