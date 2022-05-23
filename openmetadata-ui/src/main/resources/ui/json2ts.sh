#!/bin/bash
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

schema_directory='catalog-rest-service/src/main/resources/json/schema/'
om_ui_directory='openmetadata-ui/src/main/resources/ui/src/generated/'
addLicensing(){
    dir=$1
    txt=`cat openmetadata-ui/src/main/resources/ui/types-licensing.txt; cat "$dir"`
    echo "$txt" > "$dir"
}
generateType(){
    ./node_modules/.bin/quicktype -s schema $PWD"/${schema_directory}$1" -o $PWD"/"$om_ui_directory$2 --just-types
    if [ -s $om_ui_directory$2 ]
    then
        addLicensing "$om_ui_directory$2"
    else
        rm -f "$om_ui_directory$2"
    fi
}
getTypes(){
    if [ -d "$om_ui_directory" ]
    then
        rm -r $om_ui_directory
    fi

    for file_with_dir in $(find $schema_directory  -name "*.json" | sed -e 's/catalog-rest-service\/src\/main\/resources\/json\/schema\///g')
    do
        joblist=$(jobs | wc -l)
        while (( ${joblist} >= 10 ))
            do
                sleep 1
                joblist=($(jobs | wc -l))
            done
        mkdir -p "$(dirname "$om_ui_directory$file_with_dir")"
        fileTS=$(echo "$file_with_dir" | sed "s/.json/.ts/g")
        generateType "$file_with_dir" "$fileTS" &
    done
}

# Checkout root directory to generate typescript from schema
cd ../../../../..
getTypes
wait
