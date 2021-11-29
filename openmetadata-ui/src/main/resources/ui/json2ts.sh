#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

addLicensing(){
    dir=$1
    txt=`cat types-licensing.txt; cat "$dir"`
    echo "$txt" > "$dir"
}

getTypes(){
    dir=$1
    for f in $dir/*
    do
    filename=$f
    if [[ -d $f ]];
    then
        getTypes "$f" "$2" "$3"
    else
        fileTS=${f//.json/.ts}
        fileTS=${fileTS//$2/$3}
        mkdir -p "$(dirname "$fileTS")" && ../../../../../node_modules/.bin/quicktype -s schema "$f" -o "$fileTS" --just-types
        if [[ -s $fileTS ]]
        then
            addLicensing "$fileTS"
        else
            rm -f $fileTS
        fi
    fi
    done
}

rm -r $2
mkdir $2
getTypes "$1" "$1" "$2"
