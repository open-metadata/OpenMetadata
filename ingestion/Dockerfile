FROM python:3.8.10

EXPOSE 7777

COPY ./pipelines /openmetadata-ingestion/pipelines
COPY ./ingestion_scheduler /openmetadata-ingestion/ingestion_scheduler
COPY ./ingestion_dependency.sh /openmetadata-ingestion/ingestion_dependency.sh
COPY ./examples /openmetadata-ingestion/examples
WORKDIR /openmetadata-ingestion

RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev unixodbc-dev --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN chmod 777 ingestion_dependency.sh

RUN ./ingestion_dependency.sh    

CMD ["python","ingestion_scheduler/scheduler.py"]
