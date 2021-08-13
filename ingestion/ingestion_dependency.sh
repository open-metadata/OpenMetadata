#!/usr/bin/env bash
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

set -euo pipefail
pip install --upgrade setuptools openmetadata-ingestion==0.2.1 apns
# wget https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.0.0/en_core_web_sm-3.0.0-py3-none-any.whl
# pip install en_core_web_sm-3.0.0-py3-none-any.whl
python -m spacy download en_core_web_sm
rm -rf en_core_web_sm-3.0.0-py3-none-any.whl
pip install "simplescheduler@git+https://github.com/StreamlineData/sdscheduler.git#egg=simplescheduler"
