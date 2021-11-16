FROM mysql/mysql-server:latest
WORKDIR /docker-entrypoint-initdb.d
COPY docker/local-metadata/mysql-script.sql .
RUN chmod -R 775 /docker-entrypoint-initdb.d