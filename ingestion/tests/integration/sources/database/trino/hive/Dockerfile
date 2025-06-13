ARG BASE_IMAGE=bitsondatadev/hive-metastore:latest
FROM ${BASE_IMAGE}
COPY conf/metastore-site.xml /opt/apache-hive-metastore-3.0.0-bin/conf/metastore-site.xml
COPY entrypoint.sh /entrypoint.sh
ENV JDBC_CONNECTION_URL=""
ENV MINIO_ENDPOINT=""
USER root
RUN chmod +x /entrypoint.sh
USER hive