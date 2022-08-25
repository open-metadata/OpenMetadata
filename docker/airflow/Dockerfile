FROM apache/airflow:2.1.4-python3.9
USER root
RUN apt-get update \
    && apt-get install -y \
        gcc libsasl2-dev build-essential libssl-dev libffi-dev \
        librdkafka-dev unixodbc-dev libxml2 libevent-dev netcat libpq-dev postgresql postgresql-contrib --no-install-recommends  \
    && rm -rf /var/lib/apt/lists/*
USER airflow
# Download openmetadata airflow plugins
RUN curl -LJO https://github.com/open-metadata/OpenMetadata/releases/download/0.10.0-release/openmetadata-airflow-apis-plugins.tar.gz && \
    tar xzf openmetadata-airflow-apis-plugins.tar.gz && rm -rf openmetadata-airflow-apis-plugins.tar.gz
# Argument to provide for Ingestion Dependencies to install. Defaults to all
ARG INGESTION_DEPENDENCY="all"
RUN pip install --upgrade openmetadata-airflow-managed-apis openmetadata-ingestion[${INGESTION_DEPENDENCY}]

# Uninstalling psycopg2-binary and installing psycopg2 instead 
# because the psycopg2-binary generates a architecture specific error 
# while authrenticating connection with the airflow, psycopg2 solves this error 
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2

# Make and copy required folders for openmetadata-airflow-apis
RUN mkdir -p /opt/airflow/dag_generated_configs && cp -r plugins/dag_* /opt/airflow
