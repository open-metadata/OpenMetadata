FROM python:3.9-slim

RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev unixodbc-dev --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
RUN pip install 'openmetadata-ingestion[sample-data,elasticsearch,mysql]' apache-airflow==2.1.4
ENV AIRFLOW_HOME=/airflow
COPY ./ingestion /ingestion
WORKDIR /ingestion
RUN pip install -e '.[sample-data,elasticsearch,mysql]' 
RUN chmod 755 ingestion_dependency.sh

CMD [ "./ingestion_dependency.sh" ]     
