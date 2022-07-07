FROM postgres:latest
WORKDIR /docker-entrypoint-initdb.d
COPY docker/local-metadata/postgres-script.sql .
RUN chmod -R 775 /docker-entrypoint-initdb.d