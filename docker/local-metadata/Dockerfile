FROM openjdk:11

EXPOSE 8585

RUN apt-get update -y && \
    apt-get install --no-install-recommends wget -y && \
    rm -rf /var/lib/apt/lists/*
COPY docker/local-metadata/openmetadata-start.sh /
COPY docker/local-metadata/openmetadata.yaml /
COPY dist/target/openmetadata-*.tar.gz /
RUN chmod 777 openmetadata-start.sh && tar zxvf openmetadata-*.tar.gz
CMD ["./openmetadata-start.sh"]