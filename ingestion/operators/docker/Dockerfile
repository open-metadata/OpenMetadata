FROM python:3.9-buster

# Install Dependencies (listed in alphabetical order)
RUN apt-get update \
    && apt-get install -y alien \
    build-essential \
    ca-certificates \
    default-libmysqlclient-dev \
    freetds-bin \
    freetds-dev \
    gcc \
    gnupg \
    libaio1 \
    libevent-dev \
    libffi-dev \
    libpq-dev \
    libsasl2-dev \
    libsasl2-modules \
    libssl-dev \
    libxml2 \
    openjdk-11-jre \
    openssl \
    postgresql \
    postgresql-contrib \
    tdsodbc \
    unixodbc \
    unixodbc-dev \
    unzip \
    wget --no-install-recommends

# Prep to install msodbcsql18
RUN apt-get update && \
    apt-get install -y apt-transport-https && \
    curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - && \
    curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install msodbcsql18 unixodbc-dev -y

# Prep to install confluent-kafka https://github.com/confluentinc/confluent-kafka-python/issues/1326
RUN apt-get update && \
    apt-get install -y --no-install-recommends git g++ make && \
    cd /tmp && git clone https://github.com/edenhill/librdkafka.git && \
    cd librdkafka && git checkout tags/v1.9.0 && \
    ./configure && make && make install && \
    cd ../ && rm -rf librdkafka

RUN if [[ $(uname -m) == "arm64" || $(uname -m) == "aarch64" ]]; \
 then \
 wget https://download.oracle.com/otn_software/linux/instantclient/191000/instantclient-basic-linux.arm64-19.10.0.0.0dbru.zip -O /oracle-instantclient.zip && \
 unzip -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
 else \
 wget https://download.oracle.com/otn_software/linux/instantclient/1917000/instantclient-basic-linux.x64-19.17.0.0.0dbru.zip -O /oracle-instantclient.zip && \
 unzip -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
 fi

ENV LD_LIBRARY_PATH=/instantclient

WORKDIR ingestion/

# Required for Airflow DockerOperator, as we need to run the workflows from a `python main.py` command in the container.
COPY ingestion/operators/docker/main.py .

RUN pip install --upgrade pip

ARG INGESTION_DEPENDENCY="all"
RUN pip install --upgrade "openmetadata-ingestion[airflow]==0.13.2.5"
RUN pip install --upgrade "openmetadata-ingestion[${INGESTION_DEPENDENCY}]==0.13.2.5"
# Uninstalling psycopg2-binary and installing psycopg2 instead
# because the psycopg2-binary generates a architecture specific error
# while authrenticating connection with the airflow, psycopg2 solves this error
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient
