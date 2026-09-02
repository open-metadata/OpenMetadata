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

# Fetch and unpack the release. alpine only for busybox wget and tar; nothing
# from this stage reaches the runtime image except the two symlinks below.
FROM alpine:3 AS dist
ARG RI_VERSION="2.0.0-SNAPSHOT"
ENV RELEASE_URL="https://github.com/open-metadata/OpenMetadata/releases/download/${RI_VERSION}-release/openmetadata-${RI_VERSION}.tar.gz"

RUN mkdir -p /opt/openmetadata && \
    wget ${RELEASE_URL} && \
    tar zxvf openmetadata-*.tar.gz -C /opt/openmetadata --strip-components 1 && \
    rm openmetadata-*.tar.gz && \
    # The logback file appenders in conf/openmetadata.yaml write ./logs/*.log and
    # bin/openmetadata-server-start.sh writes the GC log there. 65532 is the uid
    # distroless calls `nonroot`.
    mkdir -p /opt/openmetadata/logs && \
    chown -R 65532:65532 /opt/openmetadata/logs && \
    # The debug base puts busybox on PATH at /busybox but leaves /bin empty, and
    # the entrypoint, bootstrap/openmetadata-ops.sh and the helm chart all name
    # /bin/bash or /bin/sh explicitly. `sh` is a busybox applet so a symlink is
    # enough; `bash` is not, and busybox dispatches on argv[0], so a symlink there
    # only gets you "bash: applet not found" -- hence the shim. Built in this
    # stage because the runtime image has no shell for `RUN` to use.
    mkdir -p /shim/bin && \
    ln -s /busybox/sh /shim/bin/sh && \
    printf '#!/busybox/sh\nexec /busybox/sh "$@"\n' > /shim/bin/bash && \
    chmod 755 /shim/bin/bash

# Temurin rather than the runtime's own distro, even though that puts the
# builder on a newer glibc (Ubuntu 26.04 / 2.43) than the runtime (debian 13 /
# 2.41). What matters is not the builder image's glibc but what the JDK binaries
# jlink copies were linked against: Adoptium builds those for portability, so the
# output requires at most GLIBC_2.17. Building the same runtime from
# debian:13-slim + openjdk-21-jdk-headless raises that floor to GLIBC_2.38 for no
# size win (96 MB vs 100 MB before pruning), which would pin the image to
# trixie-era bases and break on any rollback to debian 12. Temurin is also the
# distribution actions/setup-java pins across this repo's CI.
#
# ALL-MODULE-PATH on purpose: the app reaches deep into the JDK at runtime
# (dropwizard yaml -> java.beans, postgresql -> java.sql + java.naming), and a
# pruned module only fails on the code path that needed it.
FROM eclipse-temurin:21-jdk AS jre-builder

RUN jlink \
      --add-modules ALL-MODULE-PATH \
      --strip-debug \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /javaruntime

# ALL-MODULE-PATH also ships javac, jshell, jrunscript and jwebserver. Keep the
# runtime, the diagnostics and keytool, which operators need to import a custom CA.
RUN find /javaruntime/bin -type f \
      ! -name java ! -name jcmd ! -name jstack ! -name jmap \
      ! -name jinfo ! -name jps ! -name jstat ! -name jfr ! -name keytool \
      -delete

# `cc`, not `base`: the JNI natives the server loads link the GNU C++ runtime.
# DJL's libtokenizers.so and onnxruntime need libstdc++.so.6 and libgcc_s.so.1,
# and libtorch's libgfortran needs libz.so.1. base-debian12 fails the first with
# "libstdc++.so.6: cannot open shared object file"; cc-debian12 gets one step
# further and fails on libz, which it does not ship. debian13 carries all three
# plus libgomp, so nothing has to be copied in by hand. This is also why the
# image left alpine: those natives are glibc-linked and musl+gcompat cannot load
# them (gcompat exports none of the _FORTIFY_SOURCE `__*_chk` symbols they need).
#
# `debug-nonroot`, not `nonroot`: it adds busybox, which keeps the shell that
# bin/openmetadata-server-start.sh, bootstrap/openmetadata-ops.sh, the compose
# healthchecks and the helm chart's `/bin/bash -c` all depend on. A shell-free
# image is a worthwhile follow-up, but it is a coordinated change across this
# repo, openmetadata-helm-charts and a release boundary -- not a side effect of
# fixing the libc.
FROM gcr.io/distroless/cc-debian13:debug-nonroot

ARG RI_VERSION="2.0.0-SNAPSHOT"
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

# bin/openmetadata-server-start.sh and bootstrap/openmetadata-ops.sh both prefer
# $JAVA_HOME/bin/java over a bare `java`, so this is what points them at the
# jlink runtime. The JVM tuning stays where it has always been -- those scripts --
# which keeps OPENMETADATA_HEAP_OPTS and OPENMETADATA_JVM_PERFORMANCE_OPTS working.
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

COPY --from=jre-builder /javaruntime ${JAVA_HOME}
COPY --from=dist /shim/bin /bin
COPY --from=dist /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh /

# Numeric, not `nonroot`: with `runAsNonRoot: true` and no `runAsUser`, the
# kubelet has to read the uid out of the image config, and it rejects a name it
# cannot resolve ("image has non-numeric user").
USER 65532:65532

WORKDIR /opt/openmetadata
EXPOSE 8585 8586

ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
