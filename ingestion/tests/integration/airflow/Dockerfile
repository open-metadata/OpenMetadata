#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Airflow carrying the working tree's OpenMetadata lineage provider. Build context is
# ingestion/, so src/metadata/generated must already exist (make generate).

FROM apache/airflow:3.3.1-python3.10

USER airflow
COPY --chown=airflow:0 . /tmp/ingestion

# airflow-constraints-3.3.1.txt is deliberately NOT applied: it pins chardet==7.5.1
# against openmetadata-ingestion's chardet==4.0.0. Dockerfile.ci installs the package
# unconstrained for the same reason. apache-airflow is pinned so the resolver cannot move it.
RUN pip install --no-cache-dir uv \
 && uv pip install --no-cache "apache-airflow==3.3.1" /tmp/ingestion \
 && rm -rf /tmp/ingestion

# Migrating at build time keeps container start to a few seconds.
RUN airflow db migrate \
 && echo '{"admin": "admin"}' > /opt/airflow/simple_auth_manager_passwords.json

# A file, not a `bash -c` string: passing a multi-line command through the container
# runtime mangles the newlines and bash silently starts nothing.
RUN printf '%s\n' \
      '#!/usr/bin/env bash' \
      'set -e' \
      'airflow dag-processor &' \
      'airflow scheduler &' \
      'exec airflow api-server --port 8080' \
      > /opt/airflow/start-test-airflow.sh \
 && chmod +x /opt/airflow/start-test-airflow.sh
