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

# Same runtime as docker/docker-compose-quickstart/Dockerfile -- keep the two in
# sync -- but unpacked from the locally built tarball instead of a GitHub
# release. Read that file for why the base is distroless cc debug.

FROM alpine:3 AS dist

COPY openmetadata-dist/target/openmetadata-*.tar.gz /

RUN mkdir -p /opt/openmetadata && \
    tar zxvf openmetadata-*.tar.gz -C /opt/openmetadata --strip-components 1 && \
    rm openmetadata-*.tar.gz && \
    mkdir -p /opt/openmetadata/logs && \
    chown -R 65532:65532 /opt/openmetadata/logs && \
    mkdir -p /shim/bin && \
    ln -s /busybox/sh /shim/bin/sh && \
    printf '#!/busybox/sh\nexec /busybox/sh "$@"\n' > /shim/bin/bash && \
    chmod 755 /shim/bin/bash

FROM eclipse-temurin:21-jdk AS jre-builder

RUN jlink \
      --add-modules ALL-MODULE-PATH \
      --strip-debug \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /javaruntime

RUN find /javaruntime/bin -type f \
      ! -name java ! -name jcmd ! -name jstack ! -name jmap \
      ! -name jinfo ! -name jps ! -name jstat ! -name jfr ! -name keytool \
      -delete

FROM gcr.io/distroless/cc-debian13:debug-nonroot

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

COPY --from=jre-builder /javaruntime ${JAVA_HOME}
COPY --from=dist /shim/bin /bin
COPY --from=dist /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh /

USER 65532:65532

WORKDIR /opt/openmetadata
EXPOSE 8585 8586

ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
