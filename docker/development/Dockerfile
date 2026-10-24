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
# release. Read that file for why the base is distroless base debug plus the C++
# runtime packages from distroless cc.

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
    chmod 755 /shim/bin/bash && \
    # bootstrap/openmetadata-ops.sh uses /usr/bin/env in its shebang.
    mkdir -p /shim/usr/bin && \
    ln -s /busybox/env /shim/usr/bin/env

FROM eclipse-temurin:21-jdk AS jre-builder

RUN jlink \
      --add-modules ALL-MODULE-PATH \
      --strip-debug \
      --no-man-pages \
      --no-header-files \
      --compress=zip-6 \
      --output /javaruntime

# CVE-2026-91403 (ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots):
# eMudhra's compromised intermediates chain to three emSign roots
# (ECC G3, ECC C3, C1). Temurin 21.0.13 drops them from cacerts; until eclipse-temurin:21-jdk
# is on 21.0.13, drop them here by SHA-256 and fail the build if any is still trusted. Once the
# base no longer ships them nothing is deleted.
# Roots, not the advisory's intermediate fingerprints in blocked.certs: an ECDSA signature
# re-encoded as (r, n-s) gives an intermediate a new fingerprint that still verifies.
RUN set -eu; \
    roots='86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B BC4D809B15189D78DB3E1D8CF4F9726A795DA1643CA5F1358E1DDB0EDC0D7EB3 125609AA301DA0A249B97A8239CB6A34216F44DCAC9F3954B14292F2E8C8608F'; \
    certs=$(keytool -list -v -keystore /javaruntime/lib/security/cacerts -storepass changeit); \
    printf '%s\n' "$certs" \
      | awk -v roots="$roots" 'BEGIN { split(roots, r, " "); for (i in r) want[r[i]] = 1 } /^Alias name:/ { alias = substr($0, 13) } /SHA256:/ { gsub(":", "", $2); if ($2 in want) print alias }' \
      | while IFS= read -r alias; do keytool -delete -keystore /javaruntime/lib/security/cacerts -storepass changeit -alias "$alias"; done; \
    certs=$(keytool -list -v -keystore /javaruntime/lib/security/cacerts -storepass changeit); \
    if printf '%s\n' "$certs" | tr -d ':' | grep -qE "$(echo $roots | tr ' ' '|')"; then \
      echo "CVE-2026-91403: an emSign root is still trusted" >&2; exit 1; \
    fi

RUN find /javaruntime/bin -type f \
      ! -name java ! -name jcmd ! -name jstack ! -name jmap \
      ! -name jinfo ! -name jps ! -name jstat ! -name jfr ! -name keytool \
      -delete

FROM gcr.io/distroless/cc-debian13:debug-nonroot AS cxx-runtime

USER 0
SHELL ["/busybox/sh", "-c"]
RUN set -eu; \
    for pkg in gcc-14-base libgcc-s1 libstdc++6; do \
      for f in var/lib/dpkg/status.d/$pkg var/lib/dpkg/status.d/$pkg.md5sums usr/share/doc/$pkg \
               $(awk '{print $2}' /var/lib/dpkg/status.d/$pkg.md5sums); do \
        mkdir -p "/out/$(dirname "$f")"; cp -a "/$f" "/out/$f"; \
      done; \
    done; \
    for f in /usr/lib/*-linux-gnu/libstdc++.so.6; do cp -a "$f" "/out$f"; done

FROM gcr.io/distroless/base-debian13:debug-nonroot

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

COPY --from=cxx-runtime /out /
COPY --from=jre-builder /javaruntime ${JAVA_HOME}
COPY --from=dist /shim/bin /bin
COPY --from=dist /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh /
COPY --from=dist /shim/usr/bin /usr/bin

USER 65532:65532

WORKDIR /opt/openmetadata
EXPOSE 8585 8586

ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
