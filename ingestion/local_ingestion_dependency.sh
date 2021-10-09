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

pip install --upgrade setuptools '.[sample-dßata, elasticsearch]'
while ! wget -O /dev/null -o /dev/null localhost:8585; do sleep 5; done
metadata ingest -c pipelines/sample_data.json
metadata ingest -c pipelines/sample_users.json
metadata ingest -c pipelines/sample_usage.json
metadata ingest -c pipelines/metadata_to_es.json