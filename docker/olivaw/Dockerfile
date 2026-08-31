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

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG MAVEN_VERSION=3.9.9
ARG MAVEN_SHA512=a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b
ARG NODE_VERSION=22.17.0
ARG NODE_SHA256_X64=325c0f1261e0c61bcae369a1274028e9cfb7ab7949c05512c5b1e630f7e80e12
ARG NODE_SHA256_ARM64=140aee84be6774f5fb3f404be72adbe8420b523f824de82daeb5ab218dab7b18
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

# Node 22.17.0 + yarn 1.22.22 — the versions `.devcontainer/dev/devcontainer.json` pins, and what the
# UI's `package.json` requires (`node >=22.0.0`, `yarn ^1.22.0`).
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
