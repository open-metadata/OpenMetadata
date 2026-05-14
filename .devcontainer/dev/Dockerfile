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

FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# System libraries required for building OpenMetadata connectors
# Mirrors: .github/actions/prepare-for-docker-build/action.yml
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        unixodbc-dev \
        librdkafka-dev \
        gcc \
        libsasl2-dev \
        build-essential \
        libssl-dev \
        libffi-dev \
        libevent-dev \
        wkhtmltopdf \
        libkrb5-dev \
        jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
