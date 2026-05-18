# Apache Jena Fuseki Docker Image for OpenMetadata RDF Store
# eclipse-temurin replaces the deprecated `openjdk` Docker Hub images
# (`openjdk:17-jdk-slim` was removed from the registry — CI builds against it
# fail with "manifest unknown"). JRE is enough since this image only runs the
# Fuseki shell launcher; no compilation happens inside the container.
FROM eclipse-temurin:17-jre-jammy

ENV FUSEKI_VERSION=5.6.0
ENV FUSEKI_HOME=/fuseki
# FUSEKI_BASE must point at the directory containing shiro.ini so Fuseki picks
# up our auth config on boot. Without this, Fuseki falls back to its built-in
# default base (typically the working directory) and the bundled shiro.ini is
# never loaded — leaving the admin endpoints (incl. /$/compact and
# /$/datasets) reachable without authentication. The Dockerfile copies
# config.ttl + shiro.ini into /fuseki below, so we point FUSEKI_BASE there.
ENV FUSEKI_BASE=/fuseki

RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and install Fuseki
RUN wget -q https://archive.apache.org/dist/jena/binaries/apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && tar -xzf apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz \
    && mv apache-jena-fuseki-${FUSEKI_VERSION} ${FUSEKI_HOME} \
    && rm apache-jena-fuseki-${FUSEKI_VERSION}.tar.gz

WORKDIR ${FUSEKI_HOME}

# Create data directory
RUN mkdir -p /fuseki-data

# Copy custom configuration
COPY config.ttl /fuseki/config.ttl
COPY shiro.ini /fuseki/shiro.ini

# Expose Fuseki port
EXPOSE 3030

# Volume for persistent data
VOLUME ["/fuseki-data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3030/$/ping || exit 1

# Run Fuseki with OpenMetadata dataset
CMD ["./fuseki-server", "--loc=/fuseki-data", "--update", "/openmetadata"]