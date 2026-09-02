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

# gcr.io/distroless/java21-debian13 rather than a hand-built jlink runtime on a
# cc/base variant. It carries Temurin 21 plus every glibc library the JNI natives
# the server loads need: libstdc++.so.6 and libgcc_s.so.1 for DJL's
# libtokenizers.so, and libz.so.1, which libtorch's libgfortran links.
# base-debian12 fails the first with "libstdc++.so.6: cannot open shared object
# file" and cc-debian12 gets one step further and fails on libz. This is also why
# the image left alpine: those natives are glibc-linked and musl+gcompat cannot
# load them (gcompat exports none of the _FORTIFY_SOURCE `__*_chk` symbols they
# need).
#
# The trade against building our own runtime with jlink: this ships a full JDK,
# so 30 launchers instead of 9 (javac, jshell, jdb, jhsdb, jpackage among them)
# and ~129 MB more image. Bought with one fewer build stage, no glibc-floor
# reasoning between builder and runtime, and the JDK patched on the distroless
# rebuild cadence rather than by bumping a builder tag here. Note the module set
# is the same either way -- a jlink build for this app needs ALL-MODULE-PATH,
# since it reaches into java.beans, java.sql and java.naming at runtime -- so the
# difference is tool binaries, not classes.
#
# `debug-nonroot`, not `nonroot`: it adds busybox, which keeps the shell that
# bin/openmetadata-server-start.sh, bootstrap/openmetadata-ops.sh, the compose
# healthchecks and the helm chart's `/bin/bash -c` all depend on. A shell-free
# image is a worthwhile follow-up, but it is a coordinated change across this
# repo, openmetadata-helm-charts and a release boundary -- not a side effect of
# fixing the libc.
FROM gcr.io/distroless/java21-debian13:debug-nonroot

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

# JAVA_HOME is deliberately not set. This base installs the JDK under an
# arch-suffixed path (/usr/lib/jvm/temurin-21-jdk-arm64, -amd64 on the other
# arch), which a multi-arch build cannot name in a single ENV. Both
# bin/openmetadata-server-start.sh and bootstrap/openmetadata-ops.sh fall back to
# `java` on PATH when JAVA_HOME is empty, and the base symlinks /usr/bin/java. The
# JVM tuning stays where it has always been -- those scripts -- which keeps
# OPENMETADATA_HEAP_OPTS and OPENMETADATA_JVM_PERFORMANCE_OPTS working.
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
