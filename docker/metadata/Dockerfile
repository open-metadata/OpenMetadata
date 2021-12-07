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

FROM openjdk:11

EXPOSE 8585

RUN apt-get update -y && \
    apt-get install --no-install-recommends curl wget -y && \
    rm -rf /var/lib/apt/lists/*
COPY openmetadata-start.sh /
COPY openmetadata.yaml /
RUN wget https://github.com/open-metadata/OpenMetadata/releases/download/0.6.0/openmetadata-0.6.0.tar.gz
RUN chmod 777 openmetadata-start.sh && tar zxvf openmetadata-*.tar.gz
CMD ["./openmetadata-start.sh"]
