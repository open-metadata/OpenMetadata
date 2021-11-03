FROM openjdk:11

EXPOSE 8585

RUN apt-get update -y && \
    apt-get install --no-install-recommends curl wget -y && \
    rm -rf /var/lib/apt/lists/*
COPY openmetadata-start.sh /
COPY openmetadata.yaml /
RUN wget https://github.com/open-metadata/OpenMetadata/releases/download/0.5.0/openmetadata-0.5.0.tar.gz
RUN chmod 777 openmetadata-start.sh && tar zxvf openmetadata-*.tar.gz
CMD ["./openmetadata-start.sh"]
