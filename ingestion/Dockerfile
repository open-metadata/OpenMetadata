FROM python:3.9-slim as base
ENV AIRFLOW_HOME=/airflow
RUN apt-get update && \
    apt-get install -y build-essential freetds-bin freetds-dev gcc libevent-dev libffi-dev libpq-dev librdkafka-dev libsasl2-dev libsasl2-modules libssl-dev libxml2 netcat openjdk-11-jre openssl postgresql postgresql-contrib python3.9-dev tdsodbc unixodbc unixodbc-dev wget vim --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Manually fix security vulnerability from curl
#  -  https://security.snyk.io/vuln/SNYK-DEBIAN11-CURL-2936229
# Add it back to the usual apt-get install once a fix for Debian is released
RUN wget https://curl.se/download/curl-7.84.0.tar.gz && \
    tar -xvf curl-7.84.0.tar.gz && cd curl-7.84.0 && \
    ./configure --with-openssl && make && make install


FROM base as airflow
ENV AIRFLOW_VERSION=2.3.3

# install odbc driver
RUN apt-get update && \
    apt-get install -y gnupg && \
    curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - && \
    curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    rm -rf /var/lib/apt/lists/*


ENV CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-3.9.txt"
# Add docker provider for the DockerOperator
RUN pip install --upgrade pip
RUN pip install "apache-airflow[docker]==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"


FROM airflow as apis
WORKDIR /openmetadata-airflow-apis
COPY openmetadata-airflow-apis /openmetadata-airflow-apis

RUN pip install "."

FROM apis as ingestion
WORKDIR /ingestion
COPY ingestion /ingestion

ARG INGESTION_DEPENDENCY=all
RUN pip install --upgrade ".[${INGESTION_DEPENDENCY}]"

# Uninstalling psycopg2-binary and installing psycopg2 instead 
# because the psycopg2-binary generates a architecture specific error 
# while authrenticating connection with the airflow, psycopg2 solves this error 
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2


RUN airflow db init
RUN cp -r /ingestion/airflow.cfg /airflow/airflow.cfg
RUN chmod 755 ingestion_dependency.sh
EXPOSE 8080
CMD [ "./ingestion_dependency.sh" ]
