FROM apache/airflow:2.3.3-python3.9
USER root
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list
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
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*
# Required for Starting Ingestion Container in Docker Compose
COPY --chown=airflow:airflow ingestion/ingestion_dependency.sh /opt/airflow
# Required for Ingesting Sample Data
COPY --chown=airflow:airflow ingestion/examples/sample_data /home/airflow/ingestion/examples/sample_data
# Required for Airflow DAGs of Sample Data
COPY --chown=airflow:airflow ingestion/examples/airflow/dags /opt/airflow/dags
# Provide Execute Permissions to shell script
RUN chmod +x /opt/airflow/ingestion_dependency.sh
USER airflow
# Argument to provide for Ingestion Dependencies to install. Defaults to all
ARG INGESTION_DEPENDENCY="all"
RUN pip install --upgrade pip
RUN pip install --upgrade openmetadata-managed-apis --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-2.3.3/constraints-3.9.txt"
RUN pip install --upgrade openmetadata-ingestion[${INGESTION_DEPENDENCY}]
# Uninstalling psycopg2-binary and installing psycopg2 instead 
# because the psycopg2-binary generates a architecture specific error 
# while authrenticating connection with the airflow, psycopg2 solves this error 
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient
# Make required folders for openmetadata-airflow-apis
RUN mkdir -p /opt/airflow/dag_generated_configs
# This is required as it's responsible to create airflow.cfg file
RUN airflow db init && rm -f /opt/airflow/airflow.db
