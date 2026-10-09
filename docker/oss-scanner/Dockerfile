# Build image for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
#
# anthropics/oss-scanner's projects/openmetadata/project.yaml reads this file and
# threat_model.md by path. Moving or renaming them, changing the build context or /src, or
# excluding sources in the root .dockerignore breaks the enrolment; see
# ADR:2026-10-09-oss-scanner-build-image-paths-are-a-cross-repo-contract.
#
# The scanner builds this file with the repository checkout as the build context, then
# audits /src as root with NO network access. Anything needed to compile the server or run
# its unit tests must therefore be downloaded here, at build time.
#
# Scope: the OpenMetadata server, i.e. openmetadata-service and openmetadata-mcp plus the
# modules they depend on (common, openmetadata-spec and the shaded search clients). The UI,
# the Python ingestion framework and the k8s operator are in /src as source only; see
# threat_model.md next to this file.
#
# The JDK base and Maven pins match docker/olivaw/Dockerfile; bump them together.
FROM eclipse-temurin:21-jdk-jammy@sha256:dbfd085220ae632a0830166e443747d1ee89e9038d92e3b48c3e5e9d8292b9a7

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG MAVEN_VERSION=3.9.9
ARG MAVEN_SHA512=a555254d6b53d267965a3404ecb14e53c3827c09c3b94b5678835887ab404556bfaf78dcfe03ba76fa2508649dca8531c74bca4d5846513522404d48e8c4ac8b

ENV DEBIAN_FRONTEND=noninteractive \
    MAVEN_HOME=/opt/maven \
    PATH=/opt/maven/bin:$PATH

# git: openmetadata-service's buildnumber-maven-plugin reads the commit from /src/.git.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL --retry 3 --retry-all-errors \
        "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
        -o /tmp/maven.tar.gz \
    && echo "${MAVEN_SHA512}  /tmp/maven.tar.gz" | sha512sum --check --strict - \
    && mkdir -p "${MAVEN_HOME}" \
    && tar -xzf /tmp/maven.tar.gz -C "${MAVEN_HOME}" --strip-components=1 \
    && rm /tmp/maven.tar.gz \
    && mvn --version

# Scanner contract: the checkout lives inside the image, at /src.
COPY . /src
WORKDIR /src

# Build and install the server modules (and, through -am, common, openmetadata-spec and the
# shaded search clients) into /root/.m2, so that one module can be rebuilt and tested offline
# without -am, e.g.
#   mvn -o -pl openmetadata-service test -Dtest=JwtFilterTest
# Test classes are compiled here, not run.
RUN mvn -B -ntp -DskipTests install -pl openmetadata-service,openmetadata-mcp -am

# -DskipTests never resolves surefire's JUnit provider, so run the security unit tests once:
# that downloads it for offline use and proves the test setup works. Test failures are
# reported but do not fail the build; a broken test setup does.
RUN mvn -B -ntp -pl openmetadata-service surefire:test \
        -Dtest='org/openmetadata/service/security/**/*Test' \
        -Dsurefire.failIfNoSpecifiedTests=false \
        -Dmaven.test.failure.ignore=true
