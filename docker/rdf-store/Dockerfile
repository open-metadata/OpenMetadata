# Apache Jena Fuseki with bounded Graph Store uploads for OpenMetadata.
FROM eclipse-temurin:21-jre-jammy AS fuseki-runtime

# 6.2.0 fixes CVE-2026-61372: the SPARQL Update engine accepted LOAD source
# URLs pointing at local resources, so an authenticated update could read data
# off this container's filesystem. No 5.x release carries the fix.
ENV FUSEKI_VERSION=6.2.0
# From https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-6.2.0.tar.gz.sha512.
# The download below fails the build on mismatch so a tampered or truncated mirror
# artifact can never become the production triple store.
ENV FUSEKI_SHA512=ba65f5867d2d4741b2ed9e2af5a0d4fbb447909894ab2a0c6bc4dac8997f4fe339c87b13c48d45d054977769f0f8bf763ea346b1f7792d5cdc458041bd43a132
ENV FUSEKI_HOME=/fuseki
# Authentication and operator-managed registrations survive container replacement.
ENV FUSEKI_BASE=/fuseki-data/fuseki-base

# gettext-base provides `envsubst`, used by the entrypoint to inject
# FUSEKI_ADMIN_PASSWORD / FUSEKI_OPENMETADATA_PASSWORD into shiro.ini at
# container start.
RUN apt-get update && apt-get install -y \
    wget \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Download, verify, and install Fuseki
RUN wget -q https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && echo "${FUSEKI_SHA512}  apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz" | sha512sum -c - \
    && tar -xzf apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && mv apache-jena-fuseki-${FUSEKI_VERSION} ${FUSEKI_HOME} \
    && rm apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz

WORKDIR ${FUSEKI_HOME}

# Pin the launcher main class instead of relying on the script default: the
# default (FusekiServerCmd) is deprecated-for-removal in 6.2, and only the
# serverUI variant exposes the admin endpoints OpenMetadata depends on
# ($/datasets, $/compact, $/tasks) plus $/ping and $/metrics. The build fails
# here if a future Fuseki drops the class, instead of production booting a
# server without admin endpoints.
ENV MAIN=org.apache.jena.fuseki.main.cmds.FusekiServerUICmd
# Launch-with---version doubles as the existence check without needing unzip
# (absent from JRE base images): a missing or renamed main class fails here at
# build time instead of production booting without admin endpoints.
RUN java -cp ${FUSEKI_HOME}/fuseki-server.jar ${MAIN} --version

# Equal min/max heap (official jena-fuseki-docker kit convention) so the page
# cache budget is predictable: TDB2 memory-maps its indexes OUTSIDE the JVM
# heap, so container memory must exceed the heap by the page-cache headroom.
# GC logs rotate on the data volume for post-incident diagnosis.
ENV JVM_ARGS="-Xms4g -Xmx4g -Xlog:gc*:file=/fuseki-data/gc.log:time,uptime:filecount=3,filesize=10m"

# Create data directory and a dedicated non-root user (uid/gid 1000, matching
# the official jena-fuseki-docker kit). Kubernetes deployments must set
# securityContext.fsGroup: 1000 so the PVC is writable; pre-existing volumes
# created by older root-running images need a one-time `chown -R 1000:1000`.
RUN groupadd --gid 1000 fuseki \
    && useradd --uid 1000 --gid fuseki --no-create-home fuseki \
    && mkdir -p /fuseki-data \
    && chown -R fuseki:fuseki ${FUSEKI_HOME} /fuseki-data

# Custom configuration. shiro.ini ships as a TEMPLATE because Apache Shiro's
# INI realm does not interpolate ${VAR} placeholders natively — the entrypoint
# renders it into FUSEKI_BASE with the actual passwords at container start.
COPY --chown=fuseki:fuseki config.ttl /fuseki/config.ttl
COPY --chown=fuseki:fuseki shiro.ini.template /fuseki/shiro.ini.template
COPY --chown=fuseki:fuseki entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER fuseki

# Expose Fuseki port
EXPOSE 3030

# The base and two alternate TDB2 datasets share this persistent volume.
VOLUME ["/fuseki-data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3030/$/ping || exit 1

# Run Fuseki via the entrypoint (which prepares FUSEKI_BASE and renders
# shiro.ini, then execs fuseki-server). The server is launched from an
# assembler config rather than --loc so the union default graph and server-side
# query/update deadlines take effect; the
# dataset location inside config.ttl is /fuseki-data/openmetadata, which is NOT
# where the old --loc=/fuseki-data launch stored files (it wrote them directly into
# /fuseki-data). Upgrading from that layout needs the migration step in
# docs/rdf-production-setup.md - pointing at the wrong location starts an EMPTY
# store silently rather than failing.
ENTRYPOINT ["/entrypoint.sh"]
# The assembler applies identical union graph and SPARQL deadlines to all three datasets.
CMD ["./fuseki-server", "--config=/fuseki/config.ttl"]

FROM eclipse-temurin:21-jdk-jammy AS extension-builder
WORKDIR /extension
COPY --from=fuseki-runtime /fuseki/fuseki-server.jar /extension/fuseki-server.jar
COPY src/main/java /extension/src
COPY src/main/resources /extension/resources
RUN mkdir classes \
    && javac --release 21 -cp fuseki-server.jar -d classes src/org/openmetadata/fuseki/*.java \
    && jar --create --file openmetadata-fuseki-extensions.jar -C classes . -C resources .

FROM fuseki-runtime
COPY --from=extension-builder --chown=fuseki:fuseki \
    /extension/openmetadata-fuseki-extensions.jar /fuseki/extensions/openmetadata-fuseki-extensions.jar
