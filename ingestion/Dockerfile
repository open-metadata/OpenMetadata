FROM python:3.9.2

EXPOSE 7777

COPY . /catalog-ingestion

WORKDIR /catalog-ingestion

RUN apt-get update && apt-get install -y wget && \
    chmod 777 install_dependencies.sh && \
    chmod 777 run_scheduler.sh

RUN ./install_dependencies.sh
CMD ./run_scheduler.sh