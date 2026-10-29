ARG BASE_IMAGE=apache/airflow:3.3.2-python3.12
FROM mysql:8.3 AS mysql

FROM ${BASE_IMAGE}

# gRPC ships a separate CA bundle that can lag behind OS distrust updates.
ENV GRPC_DEFAULT_SSL_ROOTS_FILE_PATH=/etc/ssl/certs/ca-certificates.crt
USER root
RUN apt-get -qq update \
  && apt-get -qq install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY ingestion/airflow-constraints-3.3.2.txt /opt/openmetadata/python-tls/airflow-constraints.txt
RUN --mount=type=bind,source=ingestion/scripts/patch_python_seeds.py,target=/tmp/patch_python_seeds.py \
    /usr/local/bin/python -m pip download --no-cache-dir --no-deps --dest /tmp/python-pip "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    && /usr/local/bin/python -m pip install --no-cache-dir --upgrade /tmp/python-pip/*.whl \
    && /usr/local/bin/python -m pip install --no-cache-dir --upgrade "certifi>=2026.10.19" "uv>=0.13.4" \
    && /usr/local/bin/python /tmp/patch_python_seeds.py /tmp/python-pip/pip-26.2.2-py3-none-any.whl \
    && rm -rf /tmp/python-pip
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
  unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
  else \
  wget -q https://download.oracle.com/otn_software/linux/instantclient/1917000/instantclient-basic-linux.x64-19.17.0.0.0dbru.zip -O /oracle-instantclient.zip && \
  unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
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

USER airflow
# Argument to provide for Ingestion Dependencies to install. Defaults to all
ARG INGESTION_DEPENDENCY="all"

# Disable pip cache dir
# https://pip.pypa.io/en/stable/topics/caching/#avoiding-caching
ENV PIP_NO_CACHE_DIR=1
# Make pip silent
ENV PIP_QUIET=1
ARG RI_VERSION="2.0.0.0.dev0"
RUN python -m pip install --no-cache-dir --upgrade "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    && python -m pip install --no-cache-dir --upgrade "certifi>=2026.10.19" "uv>=0.13.4" \
    && pip install --upgrade "setuptools>=83"
RUN pip install "openmetadata-managed-apis~=${RI_VERSION}" --constraint /opt/openmetadata/python-tls/airflow-constraints.txt
RUN pip install "openmetadata-ingestion[${INGESTION_DEPENDENCY}]~=${RI_VERSION}"


# Temporary workaround for https://github.com/open-metadata/OpenMetadata/issues/9593
RUN [ $(uname -m) = "x86_64" ] \
  && pip install "openmetadata-ingestion[db2]~=${RI_VERSION}" \
  || echo "DB2 not supported on ARM architectures."

# Ship py-spy so a hung worker can be sampled in place
# (`py-spy dump --pid <pid>`) without first installing anything in the pod.
# Container-only — kept out of setup.py to avoid forcing a native binary on
# dev laptops / CI / non-container installs.
RUN pip install "py-spy>=0.3.14"

# bump python-daemon for https://github.com/apache/airflow/pull/29916
RUN pip install "python-daemon>=3.0.0"
# Keep SMTP and standard providers required by Airflow core, alongside our runtime providers.
RUN pip freeze | grep "apache-airflow-providers" | grep --invert-match -E "docker|http|cncf|fab|common|standard|smtp" | xargs pip uninstall -y
# The removed Amazon provider was the only consumer of this driver.
RUN pip uninstall -y redshift-connector
# Uninstalling psycopg2-binary and installing psycopg2 instead 
# because the psycopg2-binary generates a architecture specific error 
# while authenticating connection with the airflow, psycopg2 solves this error
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient==2.1.1


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
USER airflow
RUN python -c "import MySQLdb, psycopg2"

# Make required folders for openmetadata-airflow-apis
RUN mkdir -p /opt/airflow/dag_generated_configs
# This is required as it's responsible to create airflow.cfg file
RUN airflow db migrate && rm -f /opt/airflow/airflow.db
# Airflow's isolated prek environment carries another uv binary and CA bundle.
ENV PREK_NATIVE_TLS=true
RUN python -m pip --python /home/airflow/.local/share/uv/tools/prek/bin/python install --upgrade "uv>=0.13.4"
RUN --mount=type=bind,source=ingestion/scripts/patch_python_seeds.py,target=/tmp/patch_python_seeds.py \
    python -m pip install --no-cache-dir --upgrade "virtualenv>=21.14.12" \
    && python /tmp/patch_python_seeds.py
