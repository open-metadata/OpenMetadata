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

echo "Initializing OpenMetadata Server...";
echo "    ||||||| "
echo "  ||||   ||||      ____ "
echo " ||||     ||||    / __ \ "
echo " ||||     ||||   | |  | | _ __    ___  _ __ "
echo " |||||   |||||   | |  | || '_ \  / _ \| '_ \ "
echo " |||||||||||||   | |__| || |_) ||  __/| | | | "
echo " |||||||||||||    \____/ | .__/  \___||_| |_| "
echo " ||| ||||| |||    __  __ | |    _              _         _ "
echo " |||  |||  |||   |  \/  ||_|   | |            | |       | | "
echo " |||   |   |||   | \  / |  ___ | |_  __ _   __| |  __ _ | |_  __ _ "
echo " |||       |||   | |\/| | / _ \| __|/ _\` | / _\` | / _\` || __|/ _\` | "
echo " ||| || || |||   | |  | ||  __/| |_| (_| || (_| || (_| || |_| (_| | "
echo " ||| ||||| |||   |_|  |_| \___| \__|\__,_| \__,_| \__,_| \__|\__,_| "
echo "  ||||||||||| "
echo "    ||||||| "
echo "Starting OpenMetadata Server"
./bin/openmetadata-server-start.sh conf/openmetadata.yaml

