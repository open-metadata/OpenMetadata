# Apache Jena Fuseki Docker Image for OpenMetadata RDF Store
# eclipse-temurin replaces the deprecated `openjdk` Docker Hub images
# (`openjdk:17-jdk-slim` was removed from the registry — CI builds against it
# fail with "manifest unknown"). JRE is enough since this image only runs the
# Fuseki shell launcher; no compilation happens inside the container. The JRE is
# 21 because Fuseki 6.x is compiled with --release 21; on a 17 JRE the server
# dies at startup with UnsupportedClassVersionError, so the base image major
# version is load-bearing, not a preference.
FROM eclipse-temurin:21-jre-jammy

# 6.2.0 fixes CVE-2026-61372: the SPARQL Update engine accepted LOAD source
# URLs pointing at local resources, so an authenticated update could read data
# off this container's filesystem. No 5.x release carries the fix.
ENV FUSEKI_VERSION=6.2.0
# From https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-6.2.0.tar.gz.sha512.
# The download below fails the build on mismatch so a tampered or truncated mirror
# artifact can never become the production triple store.
ENV FUSEKI_SHA512=ba65f5867d2d4741b2ed9e2af5a0d4fbb447909894ab2a0c6bc4dac8997f4fe339c87b13c48d45d054977769f0f8bf763ea346b1f7792d5cdc458041bd43a132
ENV FUSEKI_HOME=/fuseki
# FUSEKI_BASE lives ON THE DATA VOLUME. Fuseki materializes admin-created datasets
# (our blue/green rebuild targets) plus their registrations under
# {FUSEKI_BASE}/databases and {FUSEKI_BASE}/configuration; with the previous
# FUSEKI_BASE=/fuseki those landed in the container layer and every image upgrade
# or container recreate silently destroyed them (verified empirically against a
# live container). shiro.ini is also loaded from FUSEKI_BASE — the entrypoint
# renders it there on every start.
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

# Volume for persistent data (main dataset at /fuseki-data, admin-created
# datasets + shiro.ini under /fuseki-data/fuseki-base)
VOLUME ["/fuseki-data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3030/$/ping || exit 1

# Run Fuseki via the entrypoint (which prepares FUSEKI_BASE and renders
# shiro.ini, then execs fuseki-server). The server is launched from an
# assembler config rather than --loc so server-side settings that are
# config-file-only — most importantly arq:updateTimeout — take effect; the
# dataset location inside config.ttl is /fuseki-data/openmetadata, which is NOT
# where the old --loc=/fuseki-data launch stored files (it wrote them directly into
# /fuseki-data). Upgrading from that layout needs the migration step in
# docs/rdf-production-setup.md - pointing at the wrong location starts an EMPTY
# store silently rather than failing.
ENTRYPOINT ["/entrypoint.sh"]
# Boot from config.ttl, not --loc. With --loc Fuseki builds an ad-hoc dataset and never reads
# /fuseki/config.ttl, so `tdb2:unionDefaultGraph true` and the Lucene text index silently do not
# apply. OpenMetadata writes every entity into named graphs, so without the union default graph a
# plain `?s ?p ?o` query against the dataset returns zero rows while the data sits in
# <https://open-metadata.org/graph/knowledge> - a silent wrong answer rather than an error, and
# exactly the shape of query the MCP knowledge-graph tools generate.
CMD ["./fuseki-server", "--config=/fuseki/config.ttl"]
