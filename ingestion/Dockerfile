FROM python:3.9-slim
ENV AIRFLOW_HOME=/airflow
WORKDIR /ingestion
RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev curl unixodbc-dev wget --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
ENV AIRFLOW_VERSION=2.2.1
ENV CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-3.9.txt"
RUN pip install "apache-airflow==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"

RUN pip install 'openmetadata-ingestion[sample-data,elasticsearch,mysql]'
COPY ingestion /ingestion
RUN pip install '.[sample-data,elasticsearch,mysql]'
RUN chmod 755 ingestion_dependency.sh
EXPOSE 8080
CMD [ "./ingestion_dependency.sh" ]     
