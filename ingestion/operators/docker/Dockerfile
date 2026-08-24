FROM python:3.12-slim-trixie

# The -slim base ships without curl/gnupg/ca-certificates, so bootstrap them
# before configuring third-party apt repositories.
RUN apt-get -qq update \
    && apt-get -qq install -y --no-install-recommends \
         curl ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*
# apt-key was removed in Debian 13. The repo was also pointing at Debian 11
# while the image was Debian 12 -- now matched to the actual base. The
# debian/13 "prod" repo is signed with Microsoft's newer General GPG Signer
# key (EE4D7792F748182B), which is NOT included in keys/microsoft.asc (that
# file only has the older Release-signing key) -- so the key and matching
# sources.list entry are taken from Microsoft's own config package instead of
# hand-dearmoring the wrong key.
RUN curl -fsSL -o /tmp/packages-microsoft-prod.deb \
      https://packages.microsoft.com/config/debian/13/packages-microsoft-prod.deb \
  && dpkg -i /tmp/packages-microsoft-prod.deb \
  && rm -f /tmp/packages-microsoft-prod.deb

# Install Dependencies (listed in alphabetical order)
RUN dpkg --configure -a \
    && apt-get -qq update \
    && apt-get -qq install -y \
    build-essential \
    default-libmysqlclient-dev \
    freetds-bin \
    freetds-dev \
    gcc \
    gnupg \
    # Renamed by Debian's 64-bit time_t transition; libaio1 no longer exists.
    libaio1t64 \
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
    # mysqlclient 2.2+ locates libmysqlclient through pkg-config (2.1.x used
    # mysql_config) and has no Linux wheels, so it always builds from source.
    # The slim base omits pkg-config, unlike the python:3.12-bookworm base.
    pkg-config \
    # unixodbc/odbcinst were pinned to bookworm's 2.3.11-2+deb12u1 to keep the
    # two in lockstep; trixie ships 2.3.12-2 for both, so the pins are dropped
    # rather than retargeted.
    odbcinst \
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
    # Pull any security updates newer than the base image for packages we or our
    # dependencies pull in. Version-specific Perl module names were removed:
    # trixie ships Perl 5.40, so perl-modules-5.36/libperl5.36 do not exist.
    # --only-upgrade is a no-op for packages not present in the image.
    && apt-get -qq install -y --only-upgrade \
         libgnutls30 libcap2 libcap2-bin openssh-client rsync sudo \
         libpam0g libpam-modules libpam-modules-bin libpam-runtime \
         curl libcurl4 libcurl3-gnutls libmariadb3 wget \
         perl perl-base libnss3 \
    && rm -rf /var/lib/apt/lists/*

# Add updated postgres/redshift dependencies based on libq
ENV DEBIAN_FRONTEND=noninteractive
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt/ trixie-pgdg main" > /etc/apt/sources.list.d/pgdg.list; \
    apt-get -qq update; \
    apt-get -qq install --no-install-recommends -y libpq-dev postgresql-client postgresql-common postgresql postgresql-contrib; \
    apt-get -qq autoremove -yqq --purge; \
    apt-get -qq clean && rm -rf /var/lib/apt/lists/*

# Oracle Instant Client 19.x is linked against libaio.so.1, but Debian 13's
# 64-bit time_t transition ships that library as libaio.so.1t64 (package
# libaio1t64). Installing the package satisfies apt but not the linker, so
# cx_Oracle fails at runtime with DPI-1047. Provide the legacy soname. The
# path is derived rather than hard-coded because the multiarch directory
# differs between amd64 and arm64 builds.
RUN set -eu; \
    lib="$(find /usr/lib -name 'libaio.so.1t64' -print -quit)"; \
    test -n "$lib"; \
    ln -sf "$lib" "$(dirname "$lib")/libaio.so.1"

# `||` inside a single [ ] is invalid test syntax: it made this check always
# fall through to the x86_64 branch, so arm64 builds installed the amd64 Oracle
# client. Evaluate uname once and combine with a shell-level ||.
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

# Install DB2 iAccess driver
# Mirrored on cdn.getcollate.io to decouple builds from IBM's CDN availability.
# Use dpkg --force-depends because the package declares old Debian package names (libodbc1, odbcinst1debian2)
# that don't exist in Debian 12, but the actual dependencies (unixodbc, odbcinst) are already installed.
# SHA256 pinned to v1.1.0.29 — matches the version production ingestion-slim images run.
RUN if [ $(uname -m) = "x86_64" ]; then \
  wget -q https://cdn.getcollate.io/deps/ingestion/ibm/ibm-iaccess-1.1.0.29-1.0.amd64.deb \
    -O /tmp/ibm-iaccess.deb && \
  echo "e60e968d2cee96b2851964456f5b31ab990b1aa47d8f2399607809f7d4514f58  /tmp/ibm-iaccess.deb" | sha256sum -c - && \
  dpkg -i --force-depends /tmp/ibm-iaccess.deb && \
  apt-get install -f -y --no-install-recommends && \
  rm -f /tmp/ibm-iaccess.deb; \
fi

WORKDIR ingestion/

# Required for Airflow DockerOperator, as we need to run the workflows from a `python main.py` command in the container.
COPY ingestion/operators/docker/*.py .

# Create a non-root user with a writable home directory.
# When the container runs with securityContext runAsUser: 1000 but no
# /etc/passwd entry for that UID, Python disables user site-packages.
# This causes runtime failures when tools like spacy download models
# via pip --user, as the installed packages are invisible to the import
# system. Creating the user ensures Python recognises UID 1000 and
# enables the standard ~/.local install path.
RUN groupadd -g 1000 openmetadata && useradd -m -u 1000 -g 1000 openmetadata
RUN chown -R openmetadata:openmetadata /ingestion
ENV HOME=/home/openmetadata
ENV PATH="/home/openmetadata/.local/bin:${PATH}"

# Refresh the interpreter-level pip before dropping privileges. The per-user
# pip upgrade below only writes to ~/.local, so the base image's
# /usr/local copy stays on disk and image scanners keep reporting it
# (CVE-2025-8869, CVE-2026-3219, CVE-2026-6357, CVE-2026-8643 -- fixed in 26.1.2).
RUN pip install --no-cache-dir --upgrade "pip>=26.2,<27"

USER openmetadata

# Disable pip cache dir
# https://pip.pypa.io/en/stable/topics/caching/#avoiding-caching
ENV PIP_NO_CACHE_DIR=1
# Make pip silent
ENV PIP_QUIET=1

# GCC 14 (trixie's default) turns implicit-function-declaration,
# incompatible-pointer-types, and int-conversion from warnings into hard
# errors by default. Some pinned C-extension deps (e.g. asammdf 7.4.5) predate
# that default and fail to compile without this; it does not relax any check
# performed on our own code.
ENV CFLAGS="-Wno-error=incompatible-pointer-types -Wno-error=implicit-function-declaration -Wno-error=int-conversion"

# Pin setuptools<81 as pkg_resources was removed in setuptools 81.0.0+
# cx-Oracle's setup.py still uses pkg_resources
RUN pip install --upgrade "pip>=26.2,<27" "setuptools<81"
# Pre-install cx-Oracle without build isolation to use the pinned setuptools
RUN pip install --no-build-isolation "cx_Oracle>=8.3.0,<9"

ARG INGESTION_DEPENDENCY="all"
ARG RI_VERSION="2.0.0.0.dev0"
RUN pip install "openmetadata-ingestion[airflow]~=${RI_VERSION}"
RUN pip install "openmetadata-ingestion[${INGESTION_DEPENDENCY}]~=${RI_VERSION}"


# Temporary workaround for https://github.com/open-metadata/OpenMetadata/issues/9593
RUN [ $(uname -m) = "x86_64" ] \
  && pip install "openmetadata-ingestion[db2]~=${RI_VERSION}" \
  || echo "DB2 not supported on ARM architectures."

# Uninstalling psycopg2-binary and installing psycopg2 instead
# because the psycopg2-binary generates a architecture specific error
# while authenticating connection with the airflow, psycopg2 solves this error
RUN pip uninstall psycopg2-binary -y
RUN pip install psycopg2 mysqlclient==2.1.1

# Drop build-only packages that leaked into the runtime image. libmariadb-dev
# and libmariadb-dev-compat are only needed to compile mysqlclient (done above);
# libunbound8 arrived as a transitive build dependency and nothing here resolves
# DNS through it. Together they carry 10 CVEs the runtime does not need.
# libmariadb3 and mariadb-common MUST stay -- mysqlclient links against them at
# runtime. apt-get needs root, so switch back briefly -- USER openmetadata above
# has no sudo access -- then restore the non-root user for the runtime image.
#
# Purging libmariadb-dev force-removes default-libmysqlclient-dev as a reverse
# dependency, which orphans libmariadb3/mariadb-common in apt's eyes even
# though mysqlclient's compiled extension links against them at runtime.
# apt-mark manual pins them before autoremove runs so the cleanup doesn't take
# them out too -- verified end-to-end by the `import MySQLdb` gate check.
#
# The OS security upgrades ride along in the same root layer. trixie's base ships
# util-linux 2.41-5, which carries CVE-2025-14104, CVE-2026-13595 and
# CVE-2026-27456; trixie-security has 2.41.5-0+deb13u1.
# expat is the same story one release later. It is not in the trixie base at all
# -- it arrives transitively from the top-of-file apt layer -- and that layer's
# frozen index is exactly why the image keeps shipping 2.8.2 and being reported
# for CVE-2026-72522 while trixie-security has 2.8.3-1~deb13u1.
# The package sets are computed from dpkg rather than hand-listed. One source
# package produces many binaries -- here util-linux, bsdutils, login, mount,
# liblastlog2-2, libblkid1, libmount1, libsmartcols1 and libuuid1 -- and scanners
# report each separately, so a hand-written list silently leaves behind whichever
# binary it forgot, and liblastlog2-2 is exactly the one that is easy to forget.
# Asking dpkg which installed packages came from the source cannot miss one, and
# stays correct if Debian splits the source differently later.
# util-linux is asserted non-empty and expat deliberately is not: util-linux is
# Essential, so an empty query there means dpkg-query misbehaved and the build
# must not continue, whereas expat is transitive and an empty query is a
# legitimate image with nothing to patch. Asserting one of the two is what the
# check is for -- `apt-get install --only-upgrade` with no package arguments
# exits 0, so an all-empty query would give a green build that shipped the
# vulnerable packages anyway. Fail closed.
# This deliberately does NOT go in the top-of-file apt RUN: that layer's cache
# key never changes, so an upgrade placed there freezes its Debian index with it
# and the image keeps shipping whatever was current when the layer was first
# built. Below the COPY and pip layers, the index is re-read on every build.
USER root
RUN set -eu; \
    ul="$(dpkg-query -W -f='${source:Package} ${Package}\n' | awk '$1=="util-linux"{print $2}')"; \
    [ -n "$ul" ] || { echo "no src:util-linux packages found; refusing to skip the CVE patch" >&2; exit 1; }; \
    ex="$(dpkg-query -W -f='${source:Package} ${Package}\n' | awk '$1=="expat"{print $2}')"; \
    apt-get -qq update; \
    apt-get -qq install -y --only-upgrade $ul $ex; \
    apt-get -qq purge -y libmariadb-dev libmariadb-dev-compat libunbound8; \
    apt-mark manual libmariadb3 mariadb-common; \
    apt-get -qq autoremove -y --purge; \
    rm -rf /var/lib/apt/lists/*
USER openmetadata

# Every source build is done, so the setuptools<81 pin above can be lifted. That pin is
# build-time only: cx_Oracle and mysqlclient import pkg_resources from their setup.py and
# 81.0.0 removed it, but once built both import fine against 83+. Leaving 80.x on disk is
# what keeps scanners reporting CVE-2026-59890.
# Keep this the LAST pip layer -- a later layer that compiles a package needing
# pkg_resources would fail here, and the error would not look like a setuptools problem.
RUN pip install --upgrade "setuptools>=83"


# Strip spaCy's bundled test fixture, which scanners misreport as an installed black.
# See ingestion/scripts/strip_spacy_test_fixture.sh for the rationale. Must run after the
# final pip install, or a later install restores the fixture.
COPY --chown=openmetadata:openmetadata ingestion/scripts/strip_spacy_test_fixture.sh /tmp/strip_spacy_test_fixture.sh
RUN bash /tmp/strip_spacy_test_fixture.sh && rm -f /tmp/strip_spacy_test_fixture.sh

# Drop the teradatasql driver libraries this platform cannot load. The wheel ships
# all ten platform builds (337 MB of Go shared objects); only the two this
# architecture can load are kept, taking the package to 48 MB (arm64) / 70 MB (amd64);
# see ingestion/scripts/strip_teradatasql_arch_libs.sh. Same placement rule as the
# spaCy strip -- after the final pip install, or a later install restores them.
COPY --chown=openmetadata:openmetadata ingestion/scripts/strip_teradatasql_arch_libs.sh /tmp/strip_teradatasql_arch_libs.sh
RUN bash /tmp/strip_teradatasql_arch_libs.sh && rm -f /tmp/strip_teradatasql_arch_libs.sh
