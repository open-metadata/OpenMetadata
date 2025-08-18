# Apache Jena Fuseki Docker Image for OpenMetadata RDF Store
FROM openjdk:17-jdk-slim

ENV FUSEKI_VERSION=4.10.0
ENV FUSEKI_HOME=/fuseki

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