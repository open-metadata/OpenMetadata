FROM python:3.10-bullseye

RUN curl -sS https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
RUN curl -sS https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list

# Install Dependencies (listed in alphabetical order)
RUN apt-get -qq update \
    && apt-get -qq install -y \
    alien \
    build-essential \
    default-libmysqlclient-dev \
    freetds-bin \
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
    openjdk-11-jre \
    openssl \
    postgresql \
    postgresql-contrib \
    tdsodbc \
    unixodbc \
    unixodbc-dev \
    unzip \
    git \
    wget --no-install-recommends \
    # Accept MSSQL ODBC License
    && ACCEPT_EULA=Y apt-get -qq install -y msodbcsql18 \
    && rm -rf /var/lib/apt/lists/*

# Add updated postgres/redshift dependencies based on libq
RUN curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
RUN echo "deb https://apt.postgresql.org/pub/repos/apt/ buster-pgdg main" > /etc/apt/sources.list.d/pgdg.list; \
    apt-get -qq update; \
    apt-get -qq install --no-install-recommends -y libpq-dev postgresql-client postgresql-common postgresql postgresql-contrib; \
    apt-get -qq autoremove -yqq --purge; \
    apt-get -qq clean && rm -rf /var/lib/apt/lists/*

RUN if [[ $(uname -m) == "arm64" || $(uname -m) == "aarch64" ]]; \
 then \
 wget -q https://download.oracle.com/otn_software/linux/instantclient/191000/instantclient-basic-linux.arm64-19.10.0.0.0dbru.zip -O /oracle-instantclient.zip && \
 unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
 else \
 wget -q https://download.oracle.com/otn_software/linux/instantclient/1917000/instantclient-basic-linux.x64-19.17.0.0.0dbru.zip -O /oracle-instantclient.zip && \
 unzip -qq -d /instantclient -j /oracle-instantclient.zip && rm -f /oracle-instantclient.zip; \
 fi

ENV LD_LIBRARY_PATH=/instantclient

# Security patches for base image
# monitor no fixed version for
#    https://security.snyk.io/vuln/SNYK-DEBIAN11-LIBTASN16-3061097
#    https://security.snyk.io/vuln/SNYK-DEBIAN11-MARIADB105-2940589
#    https://security.snyk.io/vuln/SNYK-DEBIAN11-BIND9-3027852
#    https://security.snyk.io/vuln/SNYK-DEBIAN11-EXPAT-3023031 we are already installed the latest
RUN echo "deb http://deb.debian.org/debian bullseye-backports main" > /etc/apt/sources.list.d/backports.list
RUN apt-get -qq update \
    && apt-get install -t bullseye-backports -y \
    curl \
    libpcre2-8-0 \
    postgresql-common \
    expat \
    bind9

WORKDIR ingestion/

# Required for Airflow DockerOperator, as we need to run the workflows from a `python main.py` command in the container.
COPY ingestion/operators/docker/*.py .

# Disable pip cache dir
# https://pip.pypa.io/en/stable/topics/caching/#avoiding-caching
ENV PIP_NO_CACHE_DIR=1
# Make pip silent
ENV PIP_QUIET=1

RUN pip install --upgrade pip

ARG INGESTION_DEPENDENCY="all"
ARG RI_VERSION="1.3.0.0.dev0"
RUN pip install --upgrade pip
RUN pip install "openmetadata-ingestion[airflow]~=${RI_VERSION}"
RUN pip install "openmetadata-ingestion[${INGESTION_DEPENDENCY}]~=${RI_VERSION}"

# Temporary workaround for https://github.com/open-metadata/OpenMetadata/issues/9593
RUN echo "Image built for $(uname -m)"
RUN if [[ $(uname -m) == "arm64" ]]; \
    then \
    pip install "ibm-db-sa~=0.4"; \
    fi

# Uninstalling psycopg2-binary and installing psycopg2 instead
# because the psycopg2-binary generates a architecture specific error
# while authenticating connection with the airflow, psycopg2 solves this error
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient==2.1.1
