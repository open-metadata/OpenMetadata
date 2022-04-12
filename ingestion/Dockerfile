FROM python:3.9-slim as base
ENV AIRFLOW_HOME=/airflow
RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev curl build-essential libssl-dev libffi-dev librdkafka-dev unixodbc-dev python3.9-dev libevent-dev wget --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
# RUN wget https://github.com/open-metadata/openmetadata-airflow-apis/releases/download/0.1/openmetadata-airflow-apis-plugin.tar.gz
# RUN tar zxvf openmetadata-airflow-apis-plugin.tar.gz

FROM base as airflow
ENV AIRFLOW_VERSION=2.1.4
ENV CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-3.9.txt"
# Add docker provider for the DockerOperator
RUN pip install "apache-airflow[docker]==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"


FROM airflow as apis
WORKDIR /openmetadata-airflow-apis
COPY openmetadata-airflow-apis /openmetadata-airflow-apis

RUN mkdir /om-airflow
RUN mv /openmetadata-airflow-apis/src/plugins /om-airflow

RUN pip install "."

FROM apis as ingestion
WORKDIR /ingestion
COPY ingestion /ingestion

RUN pip install ".[all]"

RUN airflow db init
RUN cp -r /ingestion/examples/airflow/airflow.cfg /airflow/airflow.cfg
RUN cp -r /om-airflow/plugins /airflow/plugins
RUN cp -r /om-airflow/plugins/dag_templates /airflow/
RUN mkdir -p /airflow/dag_generated_configs
RUN chmod 755 ingestion_dependency.sh
EXPOSE 8080
CMD [ "./ingestion_dependency.sh" ]
