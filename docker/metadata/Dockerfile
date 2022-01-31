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

FROM alpine:3.15

EXPOSE 8585

RUN  apk update \
  && apk upgrade \
  && apk add --update wget curl bash openjdk11 \
  && rm -rf /var/cache/apk/*

COPY docker/metadata/openmetadata-start.sh docker/metadata/openmetadata.yaml ./
RUN wget https://github.com/open-metadata/OpenMetadata/releases/download/0.8.0-release/openmetadata-0.8.0.tar.gz && \
    tar zxvf openmetadata-*.tar.gz && \
    rm openmetadata-*.tar.gz
RUN chmod 777 openmetadata-start.sh
CMD ["./openmetadata-start.sh"]
