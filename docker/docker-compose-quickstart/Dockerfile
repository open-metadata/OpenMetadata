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
ARG RI_VERSION="2.0.6"
ENV RELEASE_URL="https://github.com/open-metadata/OpenMetadata/releases/download/${RI_VERSION}-release/openmetadata-${RI_VERSION}.tar.gz"

RUN mkdir -p /opt/openmetadata && \
    wget ${RELEASE_URL} && \
    tar zxvf openmetadata-*.tar.gz -C /opt/openmetadata --strip-components 1 && \
    rm openmetadata-*.tar.gz

# Final stage
FROM alpine:3
ARG RI_VERSION="2.0.6"
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
# '!ssl_client' removes busybox wget's HTTPS helper (CVE-2025-60876) and keeps it out: it
# auto-installs with busybox + libssl3, so a plain `apk del` leaves it in place.
RUN adduser -D openmetadata && apk update && \
    apk upgrade && \
    apk add --update --no-cache bash openjdk21-jre-headless lcms2 libjpeg-turbo freetype '!ssl_client'

# alsa-lib (1 High, no Alpine fix): Alpine's openjdk21-jre is the headless JRE plus seven desktop
# libraries, and its sound library needs alsa-lib (its window ones need X11). A server uses
# neither, so install the headless JRE and copy in only the three desktop libraries that work
# without a display, from openjdk21-jre of the same build: liblcms (colour profiles, such
# as the ones PNG images carry), libfontmanager (text layout) and libjavajpeg (JPEG). lcms2,
# libjpeg-turbo and freetype are what those three link against. The build fails if alsa-lib is
# ever pulled back in.
RUN set -eu; \
    jre=$(apk info -ev openjdk21-jre-headless); \
    apk="openjdk21-jre-${jre#openjdk21-jre-headless-}.apk"; \
    cd /tmp; \
    apk fetch --no-cache openjdk21-jre; \
    if [ ! -f "$apk" ]; then \
      echo "openjdk21-jre is not the same build as $jre" >&2; exit 1; \
    fi; \
    tar -xzf "$apk" -C / \
      usr/lib/jvm/java-21-openjdk/lib/liblcms.so \
      usr/lib/jvm/java-21-openjdk/lib/libfontmanager.so \
      usr/lib/jvm/java-21-openjdk/lib/libjavajpeg.so; \
    rm "$apk"; \
    if apk info -e alsa-lib >/dev/null; then \
      echo "alsa-lib is installed again" >&2; exit 1; \
    fi

# CVE-2026-91403 and CVE-2026-114820:
# eMudhra's compromised intermediates chain to three emSign roots (ECC G3, ECC C3, C1), and
# Oracle JDK 21.0.13.0.3 removes four roots from cacerts: emSign G1, G2, ECC G3 and Comodo's
# AAA Certificate Services.
# Alpine's ca-certificates (20261020) still puts emSign G1 in the Java trust store it generates,
# so delete them all here by SHA-256; the check fails the build if any is still trusted, which
# also keeps a stale cached apk layer from shipping them.
# Roots, not the advisory's intermediate fingerprints in blocked.certs: an ECDSA signature
# re-encoded as (r, n-s) gives an intermediate a new fingerprint that still verifies.
RUN set -eu; \
    export PATH="/usr/lib/jvm/default-jvm/bin:$PATH"; roots='86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B BC4D809B15189D78DB3E1D8CF4F9726A795DA1643CA5F1358E1DDB0EDC0D7EB3 125609AA301DA0A249B97A8239CB6A34216F44DCAC9F3954B14292F2E8C8608F 40F6AF0346A99AA1CD1D555A4E9CCE62C7F9634603EE406615833DC8C8D00367 1AA0C2709E831BD6E3B5129A00BA41F7EEEF020872F1E6504BF0F6C3F24F3AF3 D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4'; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    printf '%s\n' "$certs" \
      | awk -v roots="$roots" 'BEGIN { split(roots, r, " "); for (i in r) want[r[i]] = 1 } /^Alias name:/ { alias = substr($0, 13) } /SHA256:/ { gsub(":", "", $2); if ($2 in want) print alias }' \
      | while IFS= read -r alias; do keytool -delete -cacerts -storepass changeit -alias "$alias"; done; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    if printf '%s\n' "$certs" | tr -d ':' | grep -qE "$(echo $roots | tr ' ' '|')"; then \
      echo "CVE-2026-91403, CVE-2026-114820: a distrusted root CA is still trusted" >&2; exit 1; \
    fi

COPY --chown=openmetadata:openmetadata --from=build /opt/openmetadata /opt/openmetadata
COPY --chmod=755 docker/openmetadata-start.sh ./
USER openmetadata

WORKDIR /opt/openmetadata
ENTRYPOINT [ "/bin/bash" ]
CMD ["/openmetadata-start.sh"]
