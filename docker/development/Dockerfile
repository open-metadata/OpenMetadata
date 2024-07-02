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

# Build stage
FROM alpine:3 AS build

COPY openmetadata-dist/target/openmetadata-*.tar.gz /

RUN mkdir -p /opt/openmetadata && \
    tar zxvf openmetadata-*.tar.gz -C /opt/openmetadata --strip-components 1 && \
    rm openmetadata-*.tar.gz

# Final stage
FROM alpine:3

EXPOSE 8585

RUN adduser -D openmetadata && \
    apk update && \
    apk upgrade && \
    apk add --update --no-cache bash openjdk17-jre

COPY --chown=openmetadata:openmetadata --from=build /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh /

USER openmetadata

WORKDIR /opt/openmetadata
ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
