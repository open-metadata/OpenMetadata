# Pinned by DIGEST, not by the `21-jdk-jammy` tag alone: a tag can be re-pushed, which would change
# the base under a build whose every other input (Maven, Node, ANTLR) is checksum-verified — the one
# floating input defeats the reproducibility of all of them. The tag is kept beside it for readability;
# the digest is what resolves.
#
# It is the multi-arch INDEX digest, deliberately. An arch-specific manifest digest would pin this to
# whichever machine looked it up and break the other, and this image is built on arm64 locally and
# amd64 in CI. Bump with:
#   docker buildx imagetools inspect eclipse-temurin:21-jdk-jammy --format '{{.Manifest.Digest}}'
# and check the result is an `image.index`, not an `image.manifest`.
FROM eclipse-temurin:21-jdk-jammy@sha256:dbfd085220ae632a0830166e443747d1ee89e9038d92e3b48c3e5e9d8292b9a7

# CVE-2026-91403 (ADR:2026-10-23-image-jdks-distrust-compromised-cas-by-deleting-roots):
# eMudhra's compromised intermediates chain to three emSign roots (ECC G3, ECC C3, C1). Oracle JDK
# 21.0.13.0.3 also removes emSign G1, G2 and Comodo's AAA Certificate Services from cacerts, so
# this step drops those too.
# This base is pinned by digest, so it keeps them until the digest moves to a Temurin that ships
# none of them; drop them here by SHA-256 and fail the build if any is still trusted.
# Roots, not the advisory's intermediate fingerprints in blocked.certs: an ECDSA signature
# re-encoded as (r, n-s) gives an intermediate a new fingerprint that still verifies.
RUN set -eu; \
    roots='86A1ECBA089C4A8D3BBE2734C612BA341D813E043CF9E8A862CD5C57A36BBE6B BC4D809B15189D78DB3E1D8CF4F9726A795DA1643CA5F1358E1DDB0EDC0D7EB3 125609AA301DA0A249B97A8239CB6A34216F44DCAC9F3954B14292F2E8C8608F 40F6AF0346A99AA1CD1D555A4E9CCE62C7F9634603EE406615833DC8C8D00367 1AA0C2709E831BD6E3B5129A00BA41F7EEEF020872F1E6504BF0F6C3F24F3AF3 D7A7A0FB5D7E2731D771E9484EBCDEF71D5F0C3E0A2948782BC83EE0EA699EF4'; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    printf '%s\n' "$certs" \
      | awk -v roots="$roots" 'BEGIN { split(roots, r, " "); for (i in r) want[r[i]] = 1 } /^Alias name:/ { alias = substr($0, 13) } /SHA256:/ { gsub(":", "", $2); if ($2 in want) print alias }' \
      | while IFS= read -r alias; do keytool -delete -cacerts -storepass changeit -alias "$alias"; done; \
    certs=$(keytool -list -v -cacerts -storepass changeit); \
    if printf '%s\n' "$certs" | tr -d ':' | grep -qE "$(echo $roots | tr ' ' '|')"; then \
      echo "a root CA this step removes is still trusted" >&2; exit 1; \
    fi

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG MAVEN_VERSION=3.9.9
ARG MAVEN_SHA512=a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b
ARG NODE_VERSION=22.23.4
ARG NODE_SHA256_X64=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce
ARG NODE_SHA256_ARM64=6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b
ARG YARN_VERSION=1.22.22

ENV DEBIAN_FRONTEND=noninteractive
ENV MAVEN_HOME=/opt/maven
ENV NODE_HOME=/opt/node
ENV PATH=/opt/maven/bin:/opt/node/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        unzip \
        xz-utils \
        python3 \
        python3-dev \
        python3-pip \
        python3-venv \
        build-essential \
        gcc \
        jq \
        libevent-dev \
        libffi-dev \
        libkrb5-dev \
        librdkafka-dev \
        libsasl2-dev \
        libssl-dev \
        unixodbc-dev \
        wkhtmltopdf \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# `make install_antlr_cli` writes a wrapper whose shebang is `#!/usr/bin/java -jar`, and the temurin
# base keeps java at /opt/java/openjdk/bin. Without this link the ANTLR CLI installs cleanly and then
# fails to execute — so this is what makes the Makefile target below work on this base.
RUN ln -sf "${JAVA_HOME}/bin/java" /usr/bin/java

# Maven 3.9.9 — the version `.devcontainer/dev/devcontainer.json` pins. Jammy's apt carries 3.6.3,
# which is too old for this build.
RUN curl -fsSL --retry 3 --retry-all-errors \
        "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
        -o /tmp/maven.tar.gz \
    && echo "${MAVEN_SHA512}  /tmp/maven.tar.gz" | sha512sum --check --strict - \
    && mkdir -p "${MAVEN_HOME}" \
    && tar -xzf /tmp/maven.tar.gz -C "${MAVEN_HOME}" --strip-components=1 \
    && rm /tmp/maven.tar.gz \
    && ln -sf "${MAVEN_HOME}/bin/mvn" /usr/local/bin/mvn \
    && mvn --version

# Node 22.23.4 + yarn 1.22.22 — Node must match `openmetadata-ui/src/main/resources/ui/.nvmrc` (the
# UI's `engines` floor rejects anything older); pinned here because the tarball is checksum-verified
# (ADR:2026-10-22-ui-nvmrc-is-the-one-node-pin).
#
# Arch-resolved rather than hardcoded to x64: a local install on Apple Silicon builds and runs arm64,
# and the wrong tarball fails at exec with a misleading "not found".
RUN case "$(dpkg --print-architecture)" in \
        amd64)  node_arch=x64;   node_sha="${NODE_SHA256_X64}"   ;; \
        arm64)  node_arch=arm64; node_sha="${NODE_SHA256_ARM64}" ;; \
        *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac \
    && curl -fsSL --retry 3 --retry-all-errors \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" \
        -o /tmp/node.tar.xz \
    && echo "${node_sha}  /tmp/node.tar.xz" | sha256sum --check --strict - \
    && mkdir -p "${NODE_HOME}" \
    && tar -xJf /tmp/node.tar.xz -C "${NODE_HOME}" --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && ln -sf "${NODE_HOME}/bin/node" /usr/local/bin/node \
    && ln -sf "${NODE_HOME}/bin/npm" /usr/local/bin/npm \
    && ln -sf "${NODE_HOME}/bin/npx" /usr/local/bin/npx \
    && npm install -g "yarn@${YARN_VERSION}" --force \
    && ln -sf "${NODE_HOME}/bin/yarn" /usr/local/bin/yarn \
    && node --version && yarn --version

# The ANTLR CLI, via this repo's own Makefile target rather than a second copy of the install here.
# The version, the checksum, the mirror fallback and the "is the distro's package the right version?"
# logic all live in one place that way; jammy carries 4.7.2, so the target falls through to its pinned,
# checksum-verified download. It is needed by `yarn js-antlr` (which the UI's postinstall runs) and by
# `make py_antlr` — the Java build uses antlr4-maven-plugin and needs none of this.
#
# Copying just the makefiles keeps this layer from being invalidated by every other change in the tree.
# Both are needed and neither is optional: the root Makefile's line 3 is `include ingestion/Makefile`,
# so the root one alone does not parse.
COPY Makefile /tmp/antlr/Makefile
COPY ingestion/Makefile /tmp/antlr/ingestion/Makefile
RUN make -C /tmp/antlr install_antlr_cli \
    && rm -rf /tmp/antlr \
    && antlr4 2>&1 | head -1

# Fail the BUILD rather than the run if anything olivaw depends on is missing. A missing tool otherwise
# surfaces as an exit-127 tier failure inside an attempt, which reads exactly like a genuine test
# failure and costs a cluster autopsy to tell apart.
#
# `git` is NOT in this list and must not be added: it arrives at launch, so it is absent at build time
# by design and asserting it here would fail every build. `bash` is, because the agent's Bash tool
# spawns it specifically and olivaw cannot supply it.
RUN set -eu; \
    for tool in bash sh mvn java node yarn npm python3 antlr4; do \
        command -v "$tool" >/dev/null || { echo "MISSING: $tool" >&2; exit 1; }; \
    done; \
    echo "olivaw runner image OK: $(java -version 2>&1 | head -1)"

WORKDIR /work
