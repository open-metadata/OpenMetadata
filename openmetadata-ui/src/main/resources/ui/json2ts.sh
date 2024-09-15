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

schema_directory='openmetadata-spec/src/main/resources/json/schema/'
om_ui_directory='openmetadata-ui/src/main/resources/ui/src/generated'
tmp_dir=$(mktemp -d)

addLicensing(){
    dir=$1
    txt=`cat openmetadata-ui/src/main/resources/ui/types-licensing.txt; cat "$dir"`
    echo "$txt" > "$dir"
}

generateTmpSchemaFile() {
    schema_file=$1
    tmp_schema_file=$2
    jq '(."$id" |= sub("https://open-metadata.org/schema";"";"i"))' $schema_file > $tmp_schema_file
}

generateType(){
    tmp_schema_file=$1
    output_file=$2
    #generate ts
    echo "Generating ${output_file} from specification at ${tmp_schema_file}"
    ./node_modules/.bin/quicktype -s schema $tmp_schema_file  -o $output_file --just-types > /dev/null 2>&1

    if [ -s $output_file ]
    then
        addLicensing "$output_file"
    else
        rm -f "$output_file"
    fi
}

getTypes(){
    if [ -d "$om_ui_directory" ]
    then
        rm -r $om_ui_directory
    fi
    
    for file_with_dir in $(find $schema_directory  -name "*.json" | sed -e 's/openmetadata-spec\/src\/main\/resources\/json\/schema\///g')
    do
    	local_tmp_dir="$tmp_dir/$(dirname $file_with_dir)"
	mkdir -p $local_tmp_dir
    	tmp_schema_file="${local_tmp_dir}/$(basename -- $file_with_dir)"
    	#args schema file, tmp schema file, output ts file
        generateTmpSchemaFile $PWD"/"$schema_directory$file_with_dir $tmp_schema_file
    done

    escaped_tmp_dir=$(echo $tmp_dir | sed -e 's/[]\/$*.^[]/\\&/g')
    for file_with_dir in $(find $tmp_dir  -name "*.json" | sed -e "s/${escaped_tmp_dir}//g")
    do
        joblist=$(jobs | wc -l)
        while [ ${joblist} -ge 30 ]
            do
                sleep 1
                joblist=$(jobs | wc -l)
        done
	mkdir -p "$(dirname "$om_ui_directory$file_with_dir")"
        fileTS=$(echo $file_with_dir | sed "s/.json/.ts/g")
	outputTS=$PWD"/"$om_ui_directory$fileTS
	tmp_schema_file=$tmp_dir$file_with_dir
	#args schema file, tmp schema file, output ts file
        generateType $tmp_schema_file $outputTS &
    done
    
}

# Checkout root directory to generate typescript from schema
cd ../../../../..
echo "Generating TypeScript from OpenMetadata specifications"
getTypes
wait $(jobs -p)
rm -rf $tmp_dir


