FROM python:3.9.2

EXPOSE 7777

COPY . /catalog-ingestion

WORKDIR /catalog-ingestion

RUN apt-get update && \
    apt-get install -y gcc libsasl2-dev unixodbc-dev --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN chmod 777 ingestion_dependency.sh

RUN ./ingestion_dependency.sh    

CMD ["python","ingestion_scheduler/scheduler.py"]
