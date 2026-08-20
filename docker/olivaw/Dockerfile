# The olivaw C3 *runner* image for this repository.
#
# A runner image is what PRODUCES build outputs, not what ships them. Every other Dockerfile in this
# repo is a runtime image assembled *from* a completed build — `docker/development/Dockerfile` COPYs
# `openmetadata-dist/target/*.tar.gz` and ships a JRE — and none of them can serve this role: olivaw's
# build context is a clean checkout of the mirror at a pinned commit, so `target/` does not exist there
# (it is gitignored), and a `-jre` image has no `mvn`, no `javac` and no `git`.
#
# It exists because this repo is polyglot — Java/Maven **and** Python **and** TypeScript/Yarn in one
# tree — and olivaw's alternative (`build_profile.admin_overrides`) is a single base image plus an apt
# list, which cannot describe that. §12.1 detection cannot either: it resolves what it finds to ONE
# base, and it inspects `package.json` before `pom.xml`, so this repo's root `package.json` (twenty
# lines, pinning `quicktype`) would select a Node base with no JDK at all.
#
# Point a workspace at it with `build_image: true` + `dockerfile_path: docker/olivaw/Dockerfile`. Both
# fields are create-only.
#
# WHAT OLIVAW EXPECTS OF THIS IMAGE, and why each line below is here:
#
#   - `git` — the harness clones the read-only mirror mounted at /mirror into /work and, in `github`
#     mode, fetches and pushes over HTTPS. A run without it fails before any tier.
#   - `ca-certificates` — that HTTPS fetch/push needs a trust store.
#   - `bash` — the agent's Bash tool spawns `bash` specifically, not `sh`. Ubuntu ships it, so there is
#     no line for it below; olivaw fails the run up front when it is missing
#     (`internal/agent.RequireShell`) because the failure is otherwise silent and expensive: the agent
#     edits files, cannot run the `git commit` that makes them pushable, and the run reports a POSITIVE
#     `changes_ready` for a change that no longer exists.
#   - a toolchain for the verify tiers — `run_config.build_cmd` / `test_cmd` run through `sh -c` with
#     cwd `/work`. An uninstalled command exits 127, which olivaw records as an OBSERVED tier failure,
#     indistinguishable from the tests genuinely failing.
#
# The coding agent is deliberately NOT here. olivaw injects the pinned CLI at launch from its own image
# into a shared volume, so this image needs no Node on olivaw's account and no particular libc for the
# agent's sake. It describes only this repo.
#
# No ENTRYPOINT, CMD or USER, all three on purpose:
#   - the launcher gives the runner container an explicit command (the injected harness), so an
#     ENTRYPOINT here would be dead weight;
#   - the harness clones into `/work` at the filesystem root, which a non-root user could not create.
#     The pod's fsGroup covers the volumes it mounts, not the container's own writable layer.
#
# Two idioms that work in a local `docker build` will FAIL the in-cluster kaniko build, which runs with
# a narrowed capability set and no_new_privs: `RUN setcap …` (needs SETFCAP) and `USER x` + `RUN sudo …`.
# Nothing below uses either. If a future edit fails with "Operation not permitted", that is why.

# Ubuntu 22.04, for three reasons that are all load-bearing:
#   - Java 21, which is what this repo builds with;
#   - jammy's system Python is 3.10, matching `.python-version` (3.10.18) and the version CI runs.
#     Noble (24.04) would give 3.12, which no CI job exercises;
#   - glibc rather than musl. Every Python connector wheel expects it, and olivaw selects its injected
#     agent CLI variant by the runner's libc — one of the three vendors it supports is glibc-only.
FROM eclipse-temurin:21-jdk-jammy

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

# Two groups, one layer. The first is what olivaw needs to run an attempt at all plus what the
# downloads below use; the second is the system libraries this repo's Python connectors compile
# against, copied from `.devcontainer/dev/Dockerfile` (which in turn mirrors
# `.github/actions/prepare-for-docker-build/action.yml` — keep the three in step).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
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
RUN set -eu; \
    for tool in git bash sh mvn java node yarn npm python3 antlr4; do \
        command -v "$tool" >/dev/null || { echo "MISSING: $tool" >&2; exit 1; }; \
    done; \
    echo "olivaw runner image OK: $(java -version 2>&1 | head -1)"

WORKDIR /work
