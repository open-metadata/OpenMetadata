#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

FROM ubuntu:latest AS jdk
RUN apt update
RUN DEBIAN_FRONTEND="noninteractive"  apt install -y \
    gnupg \
    curl
RUN apt-key adv \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys 0xB1998361219BD9C9
RUN curl -O https://cdn.azul.com/zulu/bin/zulu-repo_1.0.0-3_all.deb && \
    apt-get install /zulu-repo_1.0.0-3_all.deb && \
    rm /zulu-repo_1.0.0-3_all.deb
RUN apt update
RUN DEBIAN_FRONTEND="noninteractive"  apt install -y \
    zulu11-jdk-headless

FROM jdk AS builder
RUN DEBIAN_FRONTEND="noninteractive"  apt install -y \
    maven \
    git
COPY . /OpenMetadata
COPY docker/compose/patches /patches
WORKDIR /OpenMetadata
RUN for patch in `ls -1 /patches | sort`; do git apply /patches/${patch}; done
RUN git init && \
    git config --global user.email "you@example.com" && \
    git config --global user.name "Your Name" && \
    git commit --allow-empty -m "Initial commit"
RUN --mount=type=cache,target=/root/.m2 mvn clean package -B -DskipTests

FROM jdk AS openmetadata
COPY --from=builder /OpenMetadata/openmetadata-dist/target/openmetadata-0.9.0-SNAPSHOT.tar.gz .
WORKDIR /opt/openmetadata
RUN tar zxf /openmetadata-0.9.0-SNAPSHOT.tar.gz --strip 1
RUN rm /openmetadata-0.9.0-SNAPSHOT.tar.gz

FROM jdk AS metadata
COPY --from=builder /OpenMetadata /OpenMetadata
WORKDIR /OpenMetadata
RUN DEBIAN_FRONTEND="noninteractive"  apt install -y \
    python3 \
    python3-pip \
    python-is-python3 \
    vim
RUN pip install \
    datamodel-code-generator
RUN datamodel-codegen --input catalog-rest-service/src/main/resources/json  --input-file-type jsonschema --output ingestion-core/src/metadata/generated
RUN pip install ./ingestion[trino,singlestore,mysql]
RUN pip install ./ingestion-core
RUN rm -rf /OpenMetadata
WORKDIR /opt/metadata

FROM python:3.9-slim AS airflow
ENV AIRFLOW_HOME=/opt/airflow
RUN apt-get update
RUN apt-get install -y gcc libsasl2-dev curl build-essential libssl-dev libffi-dev librdkafka-dev unixodbc-dev python3.9-dev libevent-dev wget --no-install-recommends
WORKDIR /ingestion
RUN wget https://github.com/open-metadata/openmetadata-airflow-apis/releases/download/0.1/openmetadata-airflow-apis-plugin.tar.gz
RUN tar zxf openmetadata-airflow-apis-plugin.tar.gz
RUN mkdir /airflow
RUN mv plugins /airflow
ENV AIRFLOW_VERSION=2.2.1
ENV CONSTRAINT_URL="https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-3.9.txt"
# Add docker provider for the DockerOperator
RUN pip install "apache-airflow[docker]==${AIRFLOW_VERSION}" --constraint "${CONSTRAINT_URL}"
COPY --from=builder /OpenMetadata /OpenMetadata
WORKDIR /OpenMetadata
RUN pip install datamodel-code-generator
RUN datamodel-codegen --input catalog-rest-service/src/main/resources/json  --input-file-type jsonschema --output ingestion-core/src/metadata/generated
RUN pip install ./ingestion[all] openmetadata-airflow-managed-apis
RUN pip install ./ingestion-core
RUN airflow db init
RUN cp -r ingestion/examples/airflow/airflow.cfg /opt/airflow/airflow.cfg
RUN cp -r /airflow/plugins /opt/airflow/plugins
RUN cp -r /airflow/plugins/dag_templates /opt/airflow/
RUN mkdir -p /opt/airflow/dag_generated_configs
RUN cp -r /airflow/plugins/dag_managed_operators /opt/airflow/
RUN rm -rf /OpenMetadata
WORKDIR /opt/airflow
EXPOSE 8080