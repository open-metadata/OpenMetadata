ARG RI_VERSION="2.0.0.0.dev0"
ARG INGESTION_DEPENDENCY="all"
FROM python:3.12-slim-trixie@sha256:cb33f7f771ecec2ef1225cf39b159591a040391bd73e4c01f00fdfc4c47611d2 AS packages
ARG RI_VERSION
ARG INGESTION_DEPENDENCY
RUN apt-get -qq update \
    && apt-get -qq install -y --no-install-recommends default-jre-headless make curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY Makefile /build/Makefile
COPY ingestion /build/ingestion
COPY openmetadata-spec /build/openmetadata-spec
COPY openmetadata-airflow-apis /build/openmetadata-airflow-apis
COPY scripts /build/scripts
ENV PATH="/build/ingestion/.nox/generation/bin:${PATH}"
RUN make install_antlr_cli \
    && python scripts/python_environment.py --profile generation -- \
       python scripts/build_python_artifacts.py build --output-dir /artifacts --expected-version "${RI_VERSION}"
RUN python scripts/python_image_environment.py export --artifacts /artifacts \
    --kind airflow --extras "${INGESTION_DEPENDENCY}" --output-dir /artifacts/runtime

FROM mysql:8.3@sha256:9de9d54fecee6253130e65154b930978b1fcc336bcc86dfd06e89b72a2588ebe AS mysql

FROM apache/airflow:3.3.2-python3.12@sha256:9df9c8be4096b9cc626bd7cb1f2b8c712eef66c59c615f8c7e6200871ca10bd1
USER root
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
  && echo "deb [arch=amd64,arm64,armhf signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list

# Install Dependencies (listed in alphabetical order)
# Install Dependencies (listed in alphabetical order)
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get -qq update \
  && apt-get -qq install -y \
  build-essential \
  default-libmysqlclient-dev \
  freetds-dev \
  gcc \
  gnupg \
  libaio1 \
  libevent-dev \
  libffi-dev \
  libpq-dev \
  librdkafka-dev \
  libsasl2-dev \
  libsasl2-2 \
  libsasl2-modules \
  libsasl2-modules-gssapi-mit \
  libssl-dev \
  libxml2 \
  libkrb5-dev \
  default-jre-headless \
  openssl \
  # To ensure compatibility with unixodbc package
  odbcinst=2.3.11-2+deb12u1 \
  tdsodbc \
  unixodbc=2.3.11-2+deb12u1 \
  unixodbc-dev=2.3.11-2+deb12u1 \
  unzip \
  git \
  wget --no-install-recommends \
  # Accept MSSQL ODBC License
  && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
  # Pull bookworm-security fixes for known-vulnerable packages
  # (gnutls28 -> 3.7.9-2+deb12u7, libcap2 -> 1:2.66-4+deb12u3,
  # openssh -> 1:9.2p1-2+deb12u10, rsync -> 3.2.7-1+deb12u5,
  # curl/libcurl* -> 7.88.1-10+deb12u15, libmariadb3 -> 1:10.11.18-0+deb12u1,
  # wget, perl*, libnss3 -> tracked; upstream fix pending, no-op until Debian ships it).
  # linux-libc-dev (source pkg "linux") -> kernel headers that libc6-dev pulls in for
  # build-essential. A container runs the host kernel, so the headers are a build
  # artifact and the kernel CVEs scanners report against them are not reachable at
  # runtime. Tracked here so the image takes bookworm-security's kernel headers
  # rather than whatever the base image froze. This does NOT clear CVE-2026-68082:
  # that fix exists only in trixie-security (6.12.105-1, DSA-6466-1), and bookworm
  # and bookworm-security are both still "vulnerable" on the 6.1 line. The image
  # that reports it is trixie-based -- see ingestion/operators/docker/Dockerfile.
  # --only-upgrade is a no-op for packages not present in the base image.
  && apt-get -qq install -y --only-upgrade \
       libgnutls30 libcap2 libcap2-bin openssh-client rsync sudo \
       libpam0g libpam-modules libpam-modules-bin libpam-runtime \
       curl libcurl4 libcurl3-gnutls libmariadb3 wget \
       perl perl-base perl-modules-5.36 libperl5.36 libnss3 linux-libc-dev \
  # docker-ce-cli comes from the airflow base and nothing in this image runs it:
  # Airflow's DockerOperator and the ingestion test helpers both drive the daemon
  # through the docker-py SDK over the socket, never the binary. It is a 42 MB Go
  # executable, so it reports the full go/stdlib CVE set (CVE-2026-39821 Critical
  # among them) against every build. Docker's apt repo is not configured here, so
  # --only-upgrade cannot reach a fixed build; removing it is the only remediation.
  # Nothing installed depends on it -- verified with apt-get -s purge.
  && apt-get -qq purge -y \
       'imagemagick*' 'libmagick*' 'graphicsmagick*' docker-ce-cli \
  && apt-get -qq autoremove -y --purge \
  && rm -rf /var/lib/apt/lists/*
COPY --from=mysql /usr/bin/mysqldump /usr/bin/mysqldump

RUN arch="$(uname -m)"; \
    if [ "$arch" = "arm64" ] || [ "$arch" = "aarch64" ]; \
  then \
  wget -q https://download.oracle.com/otn_software/linux/instantclient/191000/instantclient-basic-linux.arm64-19.10.0.0.0dbru.zip -O /oracle-instantclient.zip && \
  sha256sum /oracle-instantclient.zip > /oracle-instantclient.sha256 && unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
  else \
  wget -q https://download.oracle.com/otn_software/linux/instantclient/1917000/instantclient-basic-linux.x64-19.17.0.0.0dbru.zip -O /oracle-instantclient.zip && \
  sha256sum /oracle-instantclient.zip > /oracle-instantclient.sha256 && unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
  fi

ENV LD_LIBRARY_PATH=/instantclient

# Install DB2 iAccess Driver
# Mirrored on cdn.getcollate.io to decouple builds from IBM's CDN availability.
# Use dpkg --force-depends because the .deb declares old Debian package names
# (libodbc1, odbcinst1debian2) that don't exist in Debian 12; the actual
# libraries (unixodbc, odbcinst) are installed earlier. SHA256 pinned to v29.
RUN if [ $(uname -m) = "x86_64" ]; then \
  wget -q https://cdn.getcollate.io/deps/ingestion/ibm/ibm-iaccess-1.1.0.29-1.0.amd64.deb -O /tmp/ibm-iaccess.deb \
  && echo "e60e968d2cee96b2851964456f5b31ab990b1aa47d8f2399607809f7d4514f58  /tmp/ibm-iaccess.deb" | sha256sum -c - \
  && dpkg -i --force-depends /tmp/ibm-iaccess.deb \
  && apt-get install -f -y --no-install-recommends \
  && rm -f /tmp/ibm-iaccess.deb; \
  fi

# Required for Starting Ingestion Container in Docker Compose
COPY --chown=airflow:0 --chmod=775 ingestion/ingestion_dependency.sh /opt/airflow
# Required for Ingesting Sample Data
COPY --chown=airflow:0 ingestion/examples/sample_data /home/airflow/ingestion/examples/sample_data
# Required for Airflow DAGs of Sample Data
COPY --chown=airflow:0 ingestion/examples/airflow/dags /opt/airflow/dags

# The base interpreter is outside the isolated application environment.
USER root
COPY --from=packages /build/ingestion/.nox/generation/bin/uv /usr/local/bin/uv
COPY --from=packages /artifacts/runtime /opt/openmetadata-runtime
COPY --from=packages /build/scripts/python_artifact_smoke.py /opt/openmetadata-runtime/smoke.py
ENV UV_NO_CACHE=1
RUN uv pip install --system --python /usr/local/bin/python --require-hashes -r /opt/openmetadata-runtime/bootstrap-tools.txt
RUN uv venv --python /usr/local/bin/python /opt/openmetadata \
    && chown -R airflow:0 /opt/openmetadata
ENV VIRTUAL_ENV=/opt/openmetadata
ENV PATH="/opt/openmetadata/bin:${PATH}"
ENV PIP_NO_CACHE_DIR=1
ENV PIP_QUIET=1
ENV CFLAGS="-Wno-error=incompatible-pointer-types -Wno-error=implicit-function-declaration -Wno-error=int-conversion"
USER airflow
RUN uv pip sync --python /opt/openmetadata/bin/python --require-hashes \
      --build-constraint /opt/openmetadata-runtime/build-constraints.txt \
      /opt/openmetadata-runtime/requirements.txt
COPY --from=packages /artifacts/*.whl /opt/openmetadata-artifacts/
ARG RI_VERSION
RUN uv pip install --python /opt/openmetadata/bin/python --no-deps --no-index \
      --find-links /opt/openmetadata-artifacts "openmetadata-ingestion==${RI_VERSION}" "openmetadata-managed-apis==${RI_VERSION}" \
    && python -I /opt/openmetadata-runtime/smoke.py --version "${RI_VERSION}" --managed-api \
       --policy /opt/openmetadata-runtime/policy.json

# Models are opt-in so the default image remains unchanged. Run this after the
# package installs and before the spaCy cleanup below, while using the runtime user.
ARG AUTO_CLASSIFICATION_LANGUAGES=""
RUN if [ -n "$AUTO_CLASSIFICATION_LANGUAGES" ]; then \
      metadata install-classification-models --languages "$AUTO_CLASSIFICATION_LANGUAGES"; \
    fi

# Strip spaCy's bundled test fixture, which scanners misreport as an installed black.
# See ingestion/scripts/strip_spacy_test_fixture.sh for the rationale. Must run after the
# final pip install, or a later install restores the fixture.
COPY --chown=airflow:0 ingestion/scripts/strip_spacy_test_fixture.sh /tmp/strip_spacy_test_fixture.sh
RUN bash /tmp/strip_spacy_test_fixture.sh && rm -f /tmp/strip_spacy_test_fixture.sh

# Drop the teradatasql driver libraries this platform cannot load. The wheel ships
# all ten platform builds (337 MB of Go shared objects); only the two this
# architecture can load are kept, taking the package to 48 MB (arm64) / 70 MB (amd64);
# see ingestion/scripts/strip_teradatasql_arch_libs.sh. Same placement rule as the
# spaCy strip -- after the final pip install, or a later install restores them.
COPY --chown=airflow:0 ingestion/scripts/strip_teradatasql_arch_libs.sh /tmp/strip_teradatasql_arch_libs.sh
RUN bash /tmp/strip_teradatasql_arch_libs.sh && rm -f /tmp/strip_teradatasql_arch_libs.sh

# Native Python extensions still need their shared libraries after header/tool cleanup.
USER root
RUN apt-mark manual libpq5 libmariadb3 mariadb-common libgcc-s1 libstdc++6 libgomp1 xz-utils bzip2 make \
  && apt-get -qq purge -y --autoremove build-essential gcc default-libmysqlclient-dev libpq-dev freetds-bin \
  && rm -rf /var/lib/apt/lists/*
RUN dpkg-query -W > /opt/openmetadata-runtime/native-packages.txt
USER airflow
RUN python -c "import MySQLdb, psycopg2"

# Make required folders for openmetadata-airflow-apis
RUN mkdir -p /opt/airflow/dag_generated_configs
# This is required as it's responsible to create airflow.cfg file
RUN airflow db migrate && rm -f /opt/airflow/airflow.db
