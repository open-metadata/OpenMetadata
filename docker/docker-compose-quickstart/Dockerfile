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
ARG RI_VERSION="1.13.7"
ENV RELEASE_URL="https://github.com/open-metadata/OpenMetadata/releases/download/${RI_VERSION}-release/openmetadata-${RI_VERSION}.tar.gz"

RUN mkdir -p /opt/openmetadata && \
    wget ${RELEASE_URL} && \
    tar zxvf openmetadata-*.tar.gz -C /opt/openmetadata --strip-components 1 && \
    rm openmetadata-*.tar.gz

# Amazon Corretto 21's Alpine build, from its official image: Alpine's openjdk21 package does
# not have OpenJDK's November 2026 security release yet. Only the jlinked runtime leaves this stage.
FROM amazoncorretto:21-alpine AS jre-builder

# --strip-java-debug-attributes, not --strip-debug: Corretto ships its native libraries
# stripped, and --strip-debug would need objcopy for nothing.
# Headless: drop the X11 and sound natives, which link libraries this image does not have. Of the
# launchers, java, keytool and the diagnostic tools stay.
RUN jlink \
      --add-modules ALL-MODULE-PATH \
      --strip-java-debug-attributes \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /javaruntime && \
    rm -f /javaruntime/lib/libawt_xawt.so /javaruntime/lib/libjawt.so \
      /javaruntime/lib/libsplashscreen.so /javaruntime/lib/libjsound.so && \
    find /javaruntime/bin -type f \
      ! -name java ! -name jcmd ! -name jstack ! -name jmap \
      ! -name jinfo ! -name jps ! -name jstat ! -name jfr ! -name keytool \
      -delete

# Final stage
FROM alpine:3
ARG RI_VERSION="1.13.7"
ARG BUILD_DATE
ARG COMMIT_ID
LABEL maintainer="OpenMetadata"
LABEL org.open-metadata.image.authors="support@openmetadata.org"
LABEL org.open-metadata.vendor="OpenMetadata"
LABEL org.open-metadata.release-version="$RI_VERSION"
LABEL org.open-metadata.description="OpenMetadata is an open source platform for metadata management and discovery."
LABEL org.open-metadata.url="https://open-metadata.org/"
LABEL org.open-metadata.vcs-url="https://github.com/open-metadata/OpenMetadata"
LABEL org.open-metadata.build-date=$BUILD_DATE
LABEL org.open-metadata.commit-id=$COMMIT_ID

EXPOSE 8585 8586
# java-cacerts builds Java's trust store from Alpine's CA store, as with the openjdk21 package,
# and rebuilds it on update-ca-certificates.
RUN adduser -D openmetadata && apk update && \
    apk upgrade && \
    apk add --update --no-cache bash java-cacerts

# Laid out as Alpine's openjdk21 package was: default-jvm, java-21-openjdk, the launchers in
# /usr/bin, and cacerts linked to the store java-cacerts writes.
COPY --from=jre-builder /javaruntime /usr/lib/jvm/java-21-amazon-corretto
RUN set -eu; \
    cd /usr/lib/jvm; \
    ln -s java-21-amazon-corretto default-jvm; \
    ln -s java-21-amazon-corretto java-21-openjdk; \
    ln -sf /etc/ssl/certs/java/cacerts default-jvm/lib/security/cacerts; \
    for tool in default-jvm/bin/*; do ln -s "../lib/jvm/$tool" /usr/bin/; done

COPY --chown=openmetadata:openmetadata --from=build /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh ./
USER openmetadata

WORKDIR /opt/openmetadata
ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
