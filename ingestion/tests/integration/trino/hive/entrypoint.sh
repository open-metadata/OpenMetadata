#!/bin/sh

export HADOOP_HOME=/opt/hadoop-3.2.0
export HADOOP_CLASSPATH=${HADOOP_HOME}/share/hadoop/tools/lib/aws-java-sdk-bundle-1.11.375.jar:${HADOOP_HOME}/share/hadoop/tools/lib/hadoop-aws-3.2.0.jar
export JAVA_HOME=/usr/local/openjdk-8
export METASTORE_DB_HOSTNAME=${METASTORE_DB_HOSTNAME:-localhost}
export METASTORE_TYPE=${METASTORE_TYPE:-mysql}

sed -i "s|%JDBC_CONNECTION_URL%|${JDBC_CONNECTION_URL}|g" /opt/apache-hive-metastore-3.0.0-bin/conf/metastore-site.xml
sed -i "s|%MINIO_ENDPOINT%|${MINIO_ENDPOINT}|g" /opt/apache-hive-metastore-3.0.0-bin/conf/metastore-site.xml

MYSQL='mysql'
POSTGRES='postgres'
if [ "${METASTORE_TYPE}" = "${MYSQL}" ]; then
  METASTORE_DB_PORT=${METASTORE_DB_PORT:-3306} # Default to 3306
  echo "Waiting for database on ${METASTORE_DB_HOSTNAME} to launch on ${METASTORE_DB_PORT} ..."
  while ! nc -z ${METASTORE_DB_HOSTNAME} ${METASTORE_DB_PORT}; do
    sleep 1
  done

  echo "Database on ${METASTORE_DB_HOSTNAME}:${METASTORE_DB_PORT} started"
  echo "Init apache hive metastore on ${METASTORE_DB_HOSTNAME}:${METASTORE_DB_PORT}"

  /opt/apache-hive-metastore-3.0.0-bin/bin/schematool -initSchema -dbType mysql
  /opt/apache-hive-metastore-3.0.0-bin/bin/start-metastore
fi

if [ "${METASTORE_TYPE}" = "${POSTGRES}" ]; then
  METASTORE_DB_PORT=${METASTORE_DB_PORT:-5432} # Default to 5432
  echo "Waiting for database on ${METASTORE_DB_HOSTNAME} to launch on ${METASTORE_DB_PORT} ..."
  while ! nc -z ${METASTORE_DB_HOSTNAME} ${METASTORE_DB_PORT}; do
    sleep 1
  done

  echo "Database on ${METASTORE_DB_HOSTNAME}:${METASTORE_DB_PORT} started"
  echo "Init apache hive metastore on ${METASTORE_DB_HOSTNAME}:${METASTORE_DB_PORT}"

  /opt/apache-hive-metastore-3.0.0-bin/bin/schematool -initSchema -dbType postgres
  /opt/apache-hive-metastore-3.0.0-bin/bin/start-metastore
fi
