FROM python:3.9-slim

# Install Dependencies (listed in alphabetical order)
RUN apt-get update \
    && apt-get install -y build-essential \
    default-libmysqlclient-dev \
    freetds-bin \
    freetds-dev \
    gcc \
    gnupg \
    libevent-dev \
    libffi-dev \
    libpq-dev \
    librdkafka-dev \
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
    wget --no-install-recommends \
    # Accept MSSQL ODBC License
    # && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ingestion/

# Required for Airflow DockerOperator, as we need to run the workflows from a `python main.py` command in the container.
COPY ingestion/operators/docker/main.py .

RUN pip install --upgrade pip

ARG INGESTION_DEPENDENCY="all"
RUN pip install --upgrade openmetadata-ingestion[${INGESTION_DEPENDENCY}]
# Uninstalling psycopg2-binary and installing psycopg2 instead
# because the psycopg2-binary generates a architecture specific error
# while authrenticating connection with the airflow, psycopg2 solves this error
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient
