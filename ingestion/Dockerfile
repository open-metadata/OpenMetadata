FROM python:3.9-slim
ENV AIRFLOW_HOME=/airflow
WORKDIR /ingestion

RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev curl unixodbc-dev wget --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
RUN pip install 'openmetadata-ingestion[sample-data,elasticsearch,mysql]' apache-airflow==2.1.4
COPY ./ingestion /ingestion
RUN pip install '.[sample-data,elasticsearch,mysql]'
RUN chmod 755 ingestion_dependency.sh
CMD [ "./ingestion_dependency.sh" ]     
