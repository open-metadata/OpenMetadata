# Apache Jena Fuseki Docker Image for OpenMetadata RDF Store
# eclipse-temurin replaces the deprecated `openjdk` Docker Hub images
# (`openjdk:17-jdk-slim` was removed from the registry — CI builds against it
# fail with "manifest unknown"). JRE is enough since this image only runs the
# Fuseki shell launcher; no compilation happens inside the container. The JRE is
# 21 because Fuseki 6.x is compiled with --release 21; on a 17 JRE the server
# dies at startup with UnsupportedClassVersionError.
FROM eclipse-temurin:21-jre-jammy

# 6.2.0 fixes CVE-2026-61372: the SPARQL Update engine accepted LOAD source
# URLs pointing at local resources, so an authenticated update could read data
# off this container's filesystem. No 5.x release carries the fix.
ENV FUSEKI_VERSION=6.2.0
ENV FUSEKI_HOME=/fuseki
# FUSEKI_BASE must point at the directory containing shiro.ini so Fuseki picks
# up our auth config on boot. Without this, Fuseki falls back to its built-in
# default base (typically the working directory) and the bundled shiro.ini is
# never loaded — leaving the admin endpoints (incl. /$/compact and
# /$/datasets) reachable without authentication. The Dockerfile copies
# config.ttl + shiro.ini into /fuseki below, so we point FUSEKI_BASE there.
ENV FUSEKI_BASE=/fuseki

# gettext-base provides `envsubst`, used by the entrypoint to inject
# FUSEKI_ADMIN_PASSWORD / FUSEKI_OPENMETADATA_PASSWORD into shiro.ini at
# container start. Without this, operators could not override the default
# Fuseki credentials via environment variables.
RUN apt-get update && apt-get install -y \
    wget \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Download and install Fuseki
RUN wget -q https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && tar -xzf apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && mv apache-jena-fuseki-${FUSEKI_VERSION} ${FUSEKI_HOME} \
    && rm apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz

WORKDIR ${FUSEKI_HOME}

# Create data directory
RUN mkdir -p /fuseki-data

# Custom configuration. shiro.ini ships as a TEMPLATE because Apache Shiro's
# INI realm does not interpolate ${VAR} placeholders natively — we have to
# render it at container start with the actual passwords. The entrypoint
# does that via envsubst.
COPY config.ttl /fuseki/config.ttl
COPY shiro.ini.template /fuseki/shiro.ini.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Fuseki port
EXPOSE 3030

# Volume for persistent data
VOLUME ["/fuseki-data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3030/$/ping || exit 1

# Run Fuseki via the entrypoint (which renders shiro.ini then execs fuseki-server)
ENTRYPOINT ["/entrypoint.sh"]
# Boot from config.ttl, not --loc. With --loc Fuseki builds an ad-hoc dataset and never reads
# /fuseki/config.ttl, so `tdb2:unionDefaultGraph true` and the Lucene text index silently do not
# apply. OpenMetadata writes every entity into named graphs, so without the union default graph a
# plain `?s ?p ?o` query against the dataset returns zero rows while the data sits in
# <https://open-metadata.org/graph/knowledge> - a silent wrong answer rather than an error, and
# exactly the shape of query the MCP knowledge-graph tools generate.
CMD ["./fuseki-server", "--config=/fuseki/config.ttl"]