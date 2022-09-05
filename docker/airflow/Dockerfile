FROM apache/airflow:2.1.4-python3.9
USER root
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list
RUN apt-get update \
    && apt-get install -y build-essential freetds-bin freetds-dev gcc gnupg libevent-dev libffi-dev libpq-dev \
       librdkafka-dev libsasl2-dev libsasl2-modules libssl-dev libxml2 openjdk-11-jre openssl \
       postgresql postgresql-contrib tdsodbc unixodbc unixodbc-dev --no-install-recommends \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
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
