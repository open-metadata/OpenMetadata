#!/usr/bin/env bash
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
#
# One-call OpenMetadata development environment setup for macOS and Linux.
#
# Written for bash 3.2 so it runs on a stock macOS /bin/bash: no associative
# arrays, no `declare -n`, no `mapfile`. (scripts/check_prerequisites.sh needs
# bash >= 4, which is why this script installs a modern bash on macOS and runs
# that check through it.)
#
#   ./scripts/dev_setup.sh              # install everything, verify, summarize
#   ./scripts/dev_setup.sh --check      # verify only, change nothing
#   make dev_setup                      # same, via the Makefile
#
# Every step is idempotent: re-running skips what is already correct.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Pinned versions. Keep in sync with scripts/check_prerequisites.sh, the UI
# package.json `engines` block, and ingestion/pyproject.toml `requires-python`.
# ---------------------------------------------------------------------------
JAVA_VERSION=21
NODE_VERSION=22
PYTHON_PREFERRED="3.11"
PYTHON_MIN="3.10"
# The package metadata intentionally has no Python ceiling, but the current dev
# dependency set (spaCy 3.7 -> Thinc 8.2 -> Blis 0.7) has no Python 3.13/3.14
# wheels and cannot build there. Keep the bootstrap on a wheel-supported minor.
PYTHON_BOOTSTRAP_SUPPORTED="3.10 3.11 3.12"
MAVEN_MIN="3.6"
ANTLR_VERSION=4.9.2
NVM_VERSION=v0.40.3

LOCAL_BIN="$HOME/.local/bin"
VENV_DIR="${OM_VENV_DIR:-env}"
ENV_FILE="$REPO_ROOT/.dev-env.local.sh"
NODE_BIN_DIR=""

case "$VENV_DIR" in
  ""|.|..|/*|*/*) fail_early="OM_VENV_DIR must be a directory name inside the repository (received: '$VENV_DIR')." ;;
  *) fail_early="" ;;
esac
[ -z "$fail_early" ] || { printf '%s\n' "$fail_early" >&2; exit 2; }

# ---------------------------------------------------------------------------
# Options
# ---------------------------------------------------------------------------
DO_TOOLS=1
DO_PYTHON=1
DO_UI=1
DO_GENERATE=1
DO_PRECOMMIT=1
DO_BUILD=0
DO_DOCKER=0
CHECK_ONLY=0
ASSUME_YES=0
SLIM_PYTHON=0
PYTHON_BIN=""

usage() {
  cat <<'USAGE'
Usage: ./scripts/dev_setup.sh [options]

Sets up a complete OpenMetadata development environment on macOS or Linux:
system toolchain, Python venv + ingestion framework, generated models, UI
dependencies, and pre-commit hooks.

Options:
  --check              Verify the environment and report; make no changes.
  -y, --yes            Non-interactive; assume yes for every prompt.
  --skip-tools         Do not install system packages (verify them only).
  --skip-python        Skip the Python venv and ingestion install.
  --skip-ui            Skip `yarn install` for the frontend.
  --skip-generate      Skip `make generate` (Pydantic/TS model generation).
  --skip-precommit     Skip installing the pre-commit hooks.
  --slim               Install ingestion `[dev]` only, not `[all-dev-env]`.
                       Much faster; omits most connector dependencies.
  --with-build         Also run `mvn clean install -DskipTests`.
  --with-docker        Also start docker/development/docker-compose.yml.
  --python <bin>       Interpreter to build the venv from (default: newest
                       python3.11+ found on PATH).
  -h, --help           Show this help.

Environment:
  OM_VENV_DIR          Virtualenv directory name (default: env).

Examples:
  ./scripts/dev_setup.sh                      # full setup
  ./scripts/dev_setup.sh --slim -y            # fast setup, no prompts
  ./scripts/dev_setup.sh --check              # diagnose an existing checkout
  ./scripts/dev_setup.sh --with-build --with-docker
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    --skip-tools) DO_TOOLS=0 ;;
    --skip-python) DO_PYTHON=0 ;;
    --skip-ui) DO_UI=0 ;;
    --skip-generate) DO_GENERATE=0 ;;
    --skip-precommit) DO_PRECOMMIT=0 ;;
    --slim) SLIM_PYTHON=1 ;;
    --with-build) DO_BUILD=1 ;;
    --with-docker) DO_DOCKER=1 ;;
    --python)
      [ $# -ge 2 ] && [ -n "$2" ] || { echo "--python requires an interpreter." >&2; usage >&2; exit 2; }
      PYTHON_BIN="$2"
      shift
      ;;
    --python=*) PYTHON_BIN="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""
fi

STEP_NO=0
WARNINGS=""
WARNING_COUNT=0

step()  { STEP_NO=$((STEP_NO + 1)); printf '\n%s==> [%d] %s%s\n' "$C_BOLD$C_BLUE" "$STEP_NO" "$*" "$C_RESET"; }
ok()    { printf '  %s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
info()  { printf '  %s·%s %s\n' "$C_DIM" "$C_RESET" "$*"; }
warn()  {
  printf '  %s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"
  WARNINGS="${WARNINGS}  - $*"$'\n'
  WARNING_COUNT=$((WARNING_COUNT + 1))
}
fail()  { printf '  %s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

confirm() {
  # confirm "question" -> 0 for yes
  [ "$ASSUME_YES" -eq 1 ] && return 0
  [ -t 0 ] || return 1
  local reply
  printf '  %s?%s %s [y/N] ' "$C_YELLOW" "$C_RESET" "$1"
  read -r reply
  case "$reply" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

run() {
  info "\$ $*"
  "$@"
}

have() { command -v "$1" >/dev/null 2>&1; }

# Single-quote a value for safe interpolation into a generated, sourceable
# shell file: a checkout path containing $, backticks or quotes must not be
# re-evaluated when the user sources it.
shquote() {
  local escaped=${1//\'/\'\\\'\'}
  printf "'%s'" "$escaped"
}

# version_ge 3.11.4 3.10 -> 0 (true)
version_ge() {
  # BSD sort on macOS has no -V. Maven versions only need a numeric dotted
  # comparison here, so keep this independent of GNU userland.
  awk -v current="$1" -v required="$2" 'BEGIN {
    current_count = split(current, current_parts, ".")
    required_count = split(required, required_parts, ".")
    count = current_count > required_count ? current_count : required_count
    for (i = 1; i <= count; i++) {
      current_part = current_parts[i] + 0
      required_part = required_parts[i] + 0
      if (current_part > required_part) exit 0
      if (current_part < required_part) exit 1
    }
    exit 0
  }'
}

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
OS=""
PKG=""
SUDO=""

detect_platform() {
  case "$(uname -s)" in
    Darwin) OS=macos; PKG=brew ;;
    Linux)
      OS=linux
      if have apt-get; then PKG=apt
      elif have dnf; then PKG=dnf
      elif have yum; then PKG=yum
      elif have pacman; then PKG=pacman
      elif have zypper; then PKG=zypper
      else PKG=unknown
      fi
      ;;
    *) fail "Unsupported platform: $(uname -s). This script supports macOS and Linux." ;;
  esac

  if [ "$(id -u)" -ne 0 ] && [ "$OS" = linux ]; then
    if have sudo; then SUDO=sudo; else SUDO=""; fi
  fi

  local arch
  arch="$(uname -m)"
  ok "Platform: $OS/$arch, package manager: $PKG"
  if [ "$OS" = linux ] && [ "$PKG" = unknown ]; then
    warn "No supported package manager found; system packages must be installed by hand."
    DO_TOOLS=0
  fi
}

# ---------------------------------------------------------------------------
# Package installation
# ---------------------------------------------------------------------------
APT_UPDATED=0

pkg_install() {
  # pkg_install <packages...>  — names are already manager-specific
  [ $# -eq 0 ] && return 0
  case "$PKG" in
    brew)   run brew install "$@" ;;
    apt)
      if [ "$APT_UPDATED" -eq 0 ]; then
        run $SUDO apt-get update -qq
        APT_UPDATED=1
      fi
      run $SUDO apt-get install -y --no-install-recommends "$@"
      ;;
    dnf)    run $SUDO dnf install -y "$@" ;;
    yum)    run $SUDO yum install -y "$@" ;;
    pacman) run $SUDO pacman -S --needed --noconfirm "$@" ;;
    zypper) run $SUDO zypper install -y "$@" ;;
    *)      warn "Cannot install $* — unsupported package manager." ; return 1 ;;
  esac
}

ensure_homebrew() {
  [ "$OS" = macos ] || return 0
  if have brew; then
    ok "Homebrew $(brew --version | head -n1 | awk '{print $2}')"
    return 0
  fi
  if [ "$CHECK_ONLY" -eq 1 ]; then
    warn "Homebrew is not installed."
    return 1
  fi
  if confirm "Homebrew is required on macOS. Install it now (runs the official installer)?"; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon installs to /opt/homebrew, Intel to /usr/local.
    if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"
    fi
    have brew || fail "Homebrew installation did not put brew on PATH."
    ok "Homebrew installed"
  else
    fail "Homebrew is required. See https://brew.sh"
  fi
}

# Base build toolchain plus the headers the ingestion wheels compile against
# (thrift/sasl, kerberos, postgres, kafka, odbc, lxml, cryptography).
install_base_packages() {
  case "$PKG" in
    brew)
      # Modern bash: scripts/check_prerequisites.sh uses `declare -A`, which
      # macOS's bundled bash 3.2 does not support.
      pkg_install bash git curl unzip jq openssl@3 libpq librdkafka unixodbc cyrus-sasl krb5 || true
      ;;
    apt)
      pkg_install build-essential git curl unzip jq pkg-config \
        libffi-dev libssl-dev libxml2-dev libxslt1-dev zlib1g-dev \
        libsasl2-dev libsasl2-modules libsasl2-modules-gssapi-mit \
        libpq-dev librdkafka-dev libkrb5-dev unixodbc-dev libevent-dev || true
      ;;
    dnf|yum)
      pkg_install gcc gcc-c++ make git curl unzip jq pkgconf-pkg-config \
        libffi-devel openssl-devel libxml2-devel libxslt-devel zlib-devel \
        cyrus-sasl-devel cyrus-sasl-gssapi libpq-devel librdkafka-devel \
        krb5-devel unixODBC-devel libevent-devel || true
      ;;
    pacman)
      pkg_install base-devel git curl unzip jq pkgconf \
        libffi openssl libxml2 libxslt zlib libsasl krb5 \
        postgresql-libs librdkafka unixodbc libevent || true
      ;;
    zypper)
      pkg_install -t pattern devel_basis || true
      pkg_install git curl unzip jq libffi-devel libopenssl-devel \
        libxml2-devel libxslt-devel cyrus-sasl-devel postgresql-devel \
        librdkafka-devel krb5-devel unixODBC-devel libevent-devel || true
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Individual tool checks / installs
# ---------------------------------------------------------------------------
java_version() {
  have java || return 1
  java -version 2>&1 | awk -F'"' '/version/ {print $2; exit}'
}

java_major() {
  local v
  v="$(java_version || true)"
  [ -n "$v" ] || return 1
  # 21.0.2 -> 21 ; legacy 1.8.0_x -> 8
  case "$v" in
    1.*) echo "$v" | cut -d. -f2 ;;
    *)   echo "$v" | cut -d. -f1 ;;
  esac
}

ensure_java() {
  local v major
  v="$(java_version || true)"
  major="$(java_major || true)"

  if [ "$major" = "$JAVA_VERSION" ]; then
    ok "Java $v"
    setup_java_home
    return 0
  fi

  # A pinned JDK may be installed but not be the default `java`; prefer it.
  if select_java_alternative; then
    v="$(java_version || true)"
    ok "Java $v"
    return 0
  fi

  if [ -n "$major" ] && [ "$major" -gt "$JAVA_VERSION" ] 2>/dev/null; then
    # The pom sets <source>/<target> 21, so the language level is fine on a newer
    # JDK. The toolchain is the risk: Lombok 1.18.36 and JaCoCo 0.8.10 predate
    # this JDK and fail on javac internals / unsupported class file versions.
    ok "Java $v"
    warn "Java $v is newer than the pinned Java $JAVA_VERSION. The pom targets 21 so compilation should hold, but Lombok 1.18.36 and JaCoCo 0.8.10 predate this JDK — if the build or tests fail on annotation processing or 'Unsupported class file major version', install JDK $JAVA_VERSION and re-run (this script then pins JAVA_HOME to it automatically)."
    setup_java_home
    return 0
  fi

  if [ -n "$v" ]; then
    info "Found Java $v; OpenMetadata needs Java $JAVA_VERSION or newer."
  fi

  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    warn "Java $JAVA_VERSION is required (found: ${v:-none})."
    return 1
  fi

  case "$PKG" in
    brew)   pkg_install "openjdk@$JAVA_VERSION" || true ;;
    apt)
      # Debian 11 and Ubuntu 20.04 have no openjdk-21 in their archives; say so
      # with a fix instead of letting apt-get fail with "no installation candidate".
      if apt_has_package "openjdk-$JAVA_VERSION-jdk"; then
        pkg_install "openjdk-$JAVA_VERSION-jdk" || true
      else
        warn "This release has no openjdk-$JAVA_VERSION-jdk. Install Temurin $JAVA_VERSION (https://adoptium.net/installation/linux) or upgrade the distro, then re-run."
        return 1
      fi
      ;;
    dnf|yum) pkg_install "java-$JAVA_VERSION-openjdk-devel" || true ;;
    pacman) pkg_install "jdk$JAVA_VERSION-openjdk" || true ;;
    zypper) pkg_install "java-$JAVA_VERSION-openjdk-devel" || true ;;
  esac
  select_java_alternative
  setup_java_home
  v="$(java_version || true)"
  case "$v" in
    "$JAVA_VERSION"|"$JAVA_VERSION".*) ok "Java $v" ;;
    *) warn "Java $JAVA_VERSION is not what 'java' resolves to (${v:-none}); set JAVA_HOME/PATH yourself." ;;
  esac
}

apt_has_package() {
  if [ "$APT_UPDATED" -eq 0 ]; then
    $SUDO apt-get update -qq >/dev/null 2>&1 || true
    APT_UPDATED=1
  fi
  local candidate
  candidate="$(apt-cache policy "$1" 2>/dev/null | awk '/Candidate:/ {print $2}')"
  [ -n "$candidate" ] && [ "$candidate" != "(none)" ]
}

# On a box with several JDKs the newest usually owns /usr/bin/java. Point the
# session at the pinned one rather than telling the user to fix it by hand.
select_java_alternative() {
  local v
  v="$(java_version || true)"
  case "$v" in "$JAVA_VERSION"|"$JAVA_VERSION".*) return 0 ;; esac

  local home
  for home in \
    "/usr/lib/jvm/java-$JAVA_VERSION-openjdk-amd64" \
    "/usr/lib/jvm/java-$JAVA_VERSION-openjdk-arm64" \
    "/usr/lib/jvm/java-$JAVA_VERSION-openjdk" \
    "/usr/lib/jvm/java-$JAVA_VERSION" \
    "/usr/lib/jvm/jdk-$JAVA_VERSION"* \
    "/usr/lib/jvm/java-$JAVA_VERSION-openjdk"* ; do
    if [ -x "$home/bin/java" ]; then
      export JAVA_HOME="$home"
      export PATH="$JAVA_HOME/bin:$PATH"
      info "Pinned JAVA_HOME to $JAVA_HOME"
      return 0
    fi
  done
  return 1
}

setup_java_home() {
  if [ "$OS" = macos ] && have brew; then
    local prefix
    prefix="$(brew --prefix "openjdk@$JAVA_VERSION" 2>/dev/null || true)"
    if [ -n "$prefix" ] && [ -d "$prefix/libexec/openjdk.jdk/Contents/Home" ]; then
      # brew's openjdk is keg-only: it is never symlinked onto PATH.
      export JAVA_HOME="$prefix/libexec/openjdk.jdk/Contents/Home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return 0
    fi
  fi
  if [ -z "${JAVA_HOME:-}" ] && have java; then
    if [ "$OS" = macos ] && have /usr/libexec/java_home; then
      JAVA_HOME="$(/usr/libexec/java_home -v "$JAVA_VERSION" 2>/dev/null || true)"
      [ -n "$JAVA_HOME" ] && export JAVA_HOME
    else
      local jbin
      jbin="$(readlink -f "$(command -v java)" 2>/dev/null || command -v java)"
      export JAVA_HOME="$(dirname "$(dirname "$jbin")")"
    fi
  fi
}

ensure_maven() {
  if have mvn; then
    local v
    v="$(mvn --version 2>/dev/null | head -n1 | awk '{print $3}')"
    if version_ge "$v" "$MAVEN_MIN"; then ok "Maven $v"; return 0; fi
    info "Found Maven $v; need >= $MAVEN_MIN."
  fi
  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    warn "Maven >= $MAVEN_MIN is required."
    return 1
  fi
  pkg_install maven
  have mvn && ok "Maven $(mvn --version | head -n1 | awk '{print $3}')"
}

node_major() {
  have node || return 1
  node --version | sed 's/^v//' | cut -d. -f1
}

ensure_node() {
  local major found_display
  major="$(node_major || true)"
  if [ "$major" = "$NODE_VERSION" ]; then
    NODE_BIN_DIR="$(dirname "$(command -v node)")"
    ok "Node $(node --version)"
    return 0
  fi
  [ -n "$major" ] && info "Found Node v$major; the current UI dependency tree requires Node $NODE_VERSION."

  if activate_installed_node; then
    ok "Node $(node --version)"
    return 0
  fi

  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    if [ -n "$major" ]; then found_display="v$major"; else found_display="none"; fi
    warn "Node $NODE_VERSION is required (found: $found_display)."
    return 1
  fi

  case "$PKG" in
    brew)
      pkg_install "node@$NODE_VERSION"
      local prefix
      prefix="$(brew --prefix "node@$NODE_VERSION" 2>/dev/null || true)"
      # node@22 is keg-only while it is not the current major.
      [ -n "$prefix" ] && [ -d "$prefix/bin" ] && export PATH="$prefix/bin:$PATH"
      ;;
    pacman) pkg_install nodejs npm ;;
    dnf|yum) pkg_install nodejs npm ;;
    zypper) pkg_install nodejs npm ;;
    apt)    pkg_install nodejs npm || true ;;
  esac

  major="$(node_major || true)"
  if [ "$major" != "$NODE_VERSION" ]; then
    install_node_via_version_manager
  fi

  major="$(node_major || true)"
  if [ "$major" = "$NODE_VERSION" ]; then
    NODE_BIN_DIR="$(dirname "$(command -v node)")"
    ok "Node $(node --version)"
  else
    fail "Could not provision Node $NODE_VERSION; install it manually (https://nodejs.org)."
  fi
}

activate_installed_node() {
  local node_prefix
  if have mise; then
    node_prefix="$(mise where "node@$NODE_VERSION" 2>/dev/null || true)"
    if [ -x "$node_prefix/bin/node" ]; then
      NODE_BIN_DIR="$node_prefix/bin"
      export PATH="$NODE_BIN_DIR:$PATH"
      hash -r
      info "Activated Node $NODE_VERSION from mise."
      return 0
    fi
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    export NVM_DIR="$nvm_dir"
    # shellcheck disable=SC1090,SC1091
    . "$NVM_DIR/nvm.sh"
    if nvm use "$NODE_VERSION" >/dev/null 2>&1; then
      NVM_USED=1
      NODE_BIN_DIR="$(dirname "$(command -v node)")"
      info "Activated Node $NODE_VERSION from nvm."
      return 0
    fi
  fi
  return 1
}

install_node_via_version_manager() {
  local node_prefix
  if have mise; then
    info "Using mise to provide Node $NODE_VERSION."
    if run mise install "node@$NODE_VERSION"; then
      node_prefix="$(mise where "node@$NODE_VERSION" 2>/dev/null || true)"
      if [ -x "$node_prefix/bin/node" ]; then
        NODE_BIN_DIR="$node_prefix/bin"
        export PATH="$NODE_BIN_DIR:$PATH"
        hash -r
        return 0
      fi
    fi
    warn "mise could not activate Node $NODE_VERSION; falling back to nvm."
  fi
  install_node_via_nvm
}

install_node_via_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    if ! confirm "Install nvm $NVM_VERSION (user-local) to provide Node $NODE_VERSION?"; then
      warn "Skipped nvm; Node $NODE_VERSION still missing."
      return 1
    fi
    local installer
    installer="$(mktemp "${TMPDIR:-/tmp}/openmetadata-nvm-install.XXXXXX")"
    run curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" -o "$installer"
    run bash "$installer"
    rm -f "$installer"
  fi
  # shellcheck disable=SC1090,SC1091
  . "$NVM_DIR/nvm.sh"
  run nvm install "$NODE_VERSION"
  run nvm use "$NODE_VERSION"
  NVM_USED=1
  NODE_BIN_DIR="$(dirname "$(command -v node)")"
}

ensure_yarn() {
  local selected_yarn="${NODE_BIN_DIR:+$NODE_BIN_DIR/yarn}"
  if [ -n "$selected_yarn" ] && [ -x "$selected_yarn" ]; then
    local v
    v="$("$selected_yarn" --version 2>/dev/null)"
    case "$v" in
      1.*) ok "Yarn $v ($selected_yarn)" ; return 0 ;;
      *) warn "Yarn $v found; this repo pins Yarn Classic (^1.22). Run: npm i -g yarn@1.22.22" ; return 1 ;;
    esac
  fi
  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    warn "Yarn ^1.22 is required for the selected Node $NODE_VERSION installation."
    return 1
  fi
  if [ -n "$NODE_BIN_DIR" ] && [ -x "$NODE_BIN_DIR/npm" ]; then
    run "$NODE_BIN_DIR/npm" install -g yarn@1.22.22
  elif [ "$PKG" = brew ]; then
    pkg_install yarn
  elif have npm; then
    run npm install -g yarn@1.22.22 || run $SUDO npm install -g yarn@1.22.22
  fi
  if [ -n "$NODE_BIN_DIR" ] && [ -x "$NODE_BIN_DIR/yarn" ]; then
    ok "Yarn $("$NODE_BIN_DIR/yarn" --version) ($NODE_BIN_DIR/yarn)"
  else
    fail "Could not install Yarn Classic for Node $NODE_VERSION."
  fi
}

python_mm() {
  "$1" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true
}

pick_python() {
  # Prefer the CI-adjacent interpreter and avoid minors on which the current
  # native dev dependencies have no wheels.
  local candidates="python$PYTHON_PREFERRED python3.12 python3.11 python3.10 python3"
  local c
  for c in $candidates; do
    have "$c" || continue
    if python_bootstrap_compatible "$c"; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

# Install a supported interpreter when the box has none. Distro package first;
# uv's standalone CPython builds as the universal fallback (no root, and the only
# option on rolling distros that ship a single, too-new python).
provision_python() {
  info "No bootstrap-compatible Python ($PYTHON_BOOTSTRAP_SUPPORTED) found; provisioning Python $PYTHON_PREFERRED."
  case "$PKG" in
    brew) pkg_install "python@$PYTHON_PREFERRED" || true ;;
    apt)
      local c
      for c in $PYTHON_PREFERRED 3.12 3.10; do
        if apt_has_package "python$c-venv"; then
          pkg_install "python$c" "python$c-venv" "python$c-dev" || true
          break
        fi
      done
      ;;
    dnf|yum) pkg_install "python$PYTHON_PREFERRED" "python$PYTHON_PREFERRED-devel" || true ;;
    zypper)  pkg_install "python${PYTHON_PREFERRED//./}" "python${PYTHON_PREFERRED//./}-devel" || true ;;
    pacman)  : ;;  # Arch ships one python; older minors live in the AUR. Use uv.
  esac

  PYTHON_BIN="$(pick_python || true)"
  [ -n "$PYTHON_BIN" ] && return 0

  provision_python_uv
  PYTHON_BIN="$(pick_python_uv || true)"
  [ -n "$PYTHON_BIN" ]
}

provision_python_uv() {
  if ! have uv; then
    if ! confirm "Install uv to provide a standalone Python $PYTHON_PREFERRED?"; then
      return 1
    fi
    case "$PKG" in
      brew|pacman|dnf|yum) pkg_install uv || true ;;
    esac
    if ! have uv; then
      local installer
      installer="$(mktemp "${TMPDIR:-/tmp}/openmetadata-uv-install.XXXXXX")"
      run curl -LsSf https://astral.sh/uv/install.sh -o "$installer"
      run sh "$installer"
      rm -f "$installer"
      export PATH="$LOCAL_BIN:$PATH"
    fi
  fi
  have uv || { warn "Could not install uv."; return 1; }
  run uv python install "$PYTHON_PREFERRED"
}

pick_python_uv() {
  have uv || return 1
  local p
  p="$(uv python find "$PYTHON_PREFERRED" 2>/dev/null || true)"
  if [ -n "$p" ] && [ -x "$p" ]; then
    echo "$p"
    return 0
  fi
  return 1
}

python_supported() {
  local mm
  mm="$(python_mm "$1")"
  [ -n "$mm" ] && version_ge "$mm" "$PYTHON_MIN"
}

python_bootstrap_compatible() {
  local mm supported
  mm="$(python_mm "$1")"
  for supported in $PYTHON_BOOTSTRAP_SUPPORTED; do
    [ "$mm" = "$supported" ] && return 0
  done
  return 1
}

ensure_python() {
  if [ -n "$PYTHON_BIN" ]; then
    have "$PYTHON_BIN" || fail "--python $PYTHON_BIN is not on PATH."
    ok "Python $("$PYTHON_BIN" --version 2>&1 | awk '{print $2}') (explicit: $PYTHON_BIN)"
    python_supported "$PYTHON_BIN" || fail "Python >= $PYTHON_MIN is required."
    python_bootstrap_compatible "$PYTHON_BIN" || fail "Python $(python_mm "$PYTHON_BIN") cannot install the current dev dependency set. Use Python $PYTHON_PREFERRED (supported bootstrap minors: $PYTHON_BOOTSTRAP_SUPPORTED)."
    return 0
  fi

  PYTHON_BIN="$(pick_python || true)"
  if [ -n "$PYTHON_BIN" ]; then
    ok "Python $("$PYTHON_BIN" --version 2>&1 | awk '{print $2}') ($PYTHON_BIN)"
    return 0
  fi

  # Report what is on the box so the warning names the actual problem.
  local found
  found="$(command -v python3 || true)"
  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    # Without an interpreter the venv and everything downstream of it cannot
    # run; skip them instead of failing on an empty $PYTHON_BIN later.
    DO_PYTHON=0
    DO_GENERATE=0
    DO_PRECOMMIT=0
    warn "No bootstrap-compatible Python found (need one of: $PYTHON_BOOTSTRAP_SUPPORTED)${found:+; system python3 is $(python_mm "$found")} — skipping the venv, model generation and pre-commit."
    return 1
  fi

  if provision_python; then
    ok "Python $("$PYTHON_BIN" --version 2>&1 | awk '{print $2}') ($PYTHON_BIN)"
    return 0
  fi

  # Do not fall through to the venv: it would rebuild the exact failure the user
  # just hit. Stop with the fix instead.
  DO_PYTHON=0
  DO_GENERATE=0
  DO_PRECOMMIT=0
  warn "Could not provision Python $PYTHON_PREFERRED — skipping the venv, model generation and pre-commit. Install it (e.g. 'uv python install $PYTHON_PREFERRED') and re-run, or pass a bootstrap-compatible --python <bin>."
  return 1
}

ensure_antlr() {
  if have antlr4 && antlr4 2>&1 | grep -Eq "Version ${ANTLR_VERSION//./\\.}([^0-9]|$)"; then
    ok "ANTLR $ANTLR_VERSION ($(command -v antlr4))"
    return 0
  fi
  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    warn "ANTLR $ANTLR_VERSION CLI is required (make install_antlr_cli)."
    return 1
  fi
  have java || { warn "ANTLR needs a JRE; install Java first."; return 1; }

  # Reuse the Makefile target: it is checksum-pinned and mirror-aware. Install
  # into ~/.local/bin so no sudo is needed.
  mkdir -p "$LOCAL_BIN"
  export PATH="$LOCAL_BIN:$PATH"
  run make -C "$REPO_ROOT" install_antlr_cli ANTLR_INSTALL_DIR="$LOCAL_BIN"

  if have antlr4; then
    ok "ANTLR $ANTLR_VERSION ($(command -v antlr4))"
  else
    warn "ANTLR install did not land on PATH; add $LOCAL_BIN to PATH."
  fi
}

ensure_docker() {
  if have docker && docker info >/dev/null 2>&1; then
    ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) (daemon reachable)"
    return 0
  fi
  if have docker; then
    warn "Docker is installed but the daemon is not reachable (start Docker Desktop, or: sudo systemctl start docker)."
    return 1
  fi
  if [ "$OS" = macos ]; then
    warn "Docker not found. Install Docker Desktop (https://docker.com/products/docker-desktop) or 'brew install colima docker && colima start'."
    return 1
  fi
  if [ "$DO_TOOLS" -eq 0 ] || [ "$CHECK_ONLY" -eq 1 ]; then
    warn "Docker is required to run the local stack."
    return 1
  fi
  if confirm "Docker is not installed. Install it from the distro repositories?"; then
    case "$PKG" in
      apt)     pkg_install docker.io docker-compose-plugin || pkg_install docker.io ;;
      dnf|yum) pkg_install docker docker-compose-plugin || pkg_install docker ;;
      pacman)  pkg_install docker docker-compose ;;
      zypper)  pkg_install docker docker-compose ;;
    esac
    have systemctl && run $SUDO systemctl enable --now docker || true
    warn "Add yourself to the docker group and re-login: sudo usermod -aG docker ${USER:-$(id -un)}"
  else
    warn "Skipped Docker; the local stack (docker/development) will not run."
  fi
}

# ---------------------------------------------------------------------------
# Repository setup steps
# ---------------------------------------------------------------------------
setup_venv() {
  # A venv built from an unsupported interpreter cannot be repaired by
  # reinstalling into it — the interpreter is baked in. Rebuild it.
  if [ -x "$VENV_DIR/bin/python" ] && ! python_bootstrap_compatible "$VENV_DIR/bin/python"; then
    warn "The existing $VENV_DIR uses Python $(python_mm "$VENV_DIR/bin/python"), which cannot install the current native dev dependencies."
    if confirm "Delete $VENV_DIR and rebuild it from $PYTHON_BIN?"; then
      run rm -rf "$VENV_DIR"
    else
      fail "Cannot continue with a venv on Python $(python_mm "$VENV_DIR/bin/python"). Re-run with --python <bin>, or delete $VENV_DIR yourself."
    fi
  fi

  if [ ! -d "$VENV_DIR" ]; then
    run "$PYTHON_BIN" -m venv "$VENV_DIR"
    ok "Created virtualenv at $VENV_DIR"
  else
    ok "Virtualenv $VENV_DIR already exists"
  fi
  # shellcheck disable=SC1090,SC1091
  . "$VENV_DIR/bin/activate"
  info "Using $(python --version 2>&1) from $VIRTUAL_ENV"
}

# Homebrew keeps openssl/cyrus-sasl/krb5/libpq/unixodbc keg-only: installed, but
# not linked into /usr/local, so a source build of sasl/kerberos/psycopg cannot
# find their headers. Point the compiler at the kegs for the pip phase.
export_brew_build_flags() {
  [ "$OS" = macos ] || return 0
  have brew || return 0
  local f prefix ldflags cppflags pcpath
  ldflags=""; cppflags=""; pcpath=""
  for f in openssl@3 cyrus-sasl krb5 libpq unixodbc; do
    prefix="$(brew --prefix "$f" 2>/dev/null || true)"
    [ -n "$prefix" ] && [ -d "$prefix" ] || continue
    [ -d "$prefix/lib" ] && ldflags="$ldflags -L$prefix/lib"
    [ -d "$prefix/include" ] && cppflags="$cppflags -I$prefix/include"
    [ -d "$prefix/lib/pkgconfig" ] && pcpath="$prefix/lib/pkgconfig:$pcpath"
    # sasl/krb5 ship their binaries keg-only too; some setup.py probe for them.
    [ -d "$prefix/bin" ] && export PATH="$prefix/bin:$PATH"
  done
  export LDFLAGS="${ldflags}${LDFLAGS:+ $LDFLAGS}"
  export CPPFLAGS="${cppflags}${CPPFLAGS:+ $CPPFLAGS}"
  export PKG_CONFIG_PATH="${pcpath}${PKG_CONFIG_PATH:-}"
  info "Exported LDFLAGS/CPPFLAGS/PKG_CONFIG_PATH for Homebrew keg-only formulae"
}

install_ingestion() {
  export_brew_build_flags
  run python -m pip install --upgrade pip "setuptools<81"
  if [ "$SLIM_PYTHON" -eq 1 ]; then
    info "Slim mode: installing ingestion[dev] only."
    run make -C "$REPO_ROOT" install_dev
  else
    info "Installing the full dev environment; this pulls every connector's dependencies and takes a while."
    run make -C "$REPO_ROOT" install_dev_env
  fi
  ok "Ingestion framework installed"
}

generate_models() {
  # `make generate` wipes and regenerates ingestion/src/metadata/generated and
  # the ANTLR parsers, then reinstalls the ingestion package.
  run make -C "$REPO_ROOT" generate
  ok "Generated Pydantic models and ANTLR parsers"
}

install_ui_deps() {
  if [ "$(node_major || true)" != "$NODE_VERSION" ]; then
    fail "Refusing to run Yarn with $(node --version 2>/dev/null || echo no Node); the current UI dependencies require Node $NODE_VERSION."
  fi
  run make -C "$REPO_ROOT" yarn_install_cache
  ok "UI dependencies installed"
}

install_precommit() {
  run make -C "$REPO_ROOT" install_test
  run make -C "$REPO_ROOT" precommit_install
  ok "pre-commit hooks installed (format + license gate on every commit)"
}

maven_build() {
  run mvn -f "$REPO_ROOT/pom.xml" clean install -DskipTests -T 1C
  ok "Maven build complete"
}

start_docker_stack() {
  run docker compose -f "$REPO_ROOT/docker/development/docker-compose.yml" up -d
  ok "Local stack starting; UI will come up on http://localhost:8585"
}

run_prerequisite_check() {
  # check_prerequisites.sh needs bash >= 4 (declare -A); macOS ships 3.2.
  local bash_bin="bash"
  if [ "$OS" = macos ]; then
    if have brew && [ -x "$(brew --prefix 2>/dev/null)/bin/bash" ]; then
      bash_bin="$(brew --prefix)/bin/bash"
    fi
  fi
  local bash_major
  bash_major="$("$bash_bin" -c 'echo ${BASH_VERSINFO[0]}' 2>/dev/null || echo 0)"
  if [ "$bash_major" -lt 4 ] 2>/dev/null; then
    warn "Skipping scripts/check_prerequisites.sh: it needs bash >= 4 and only bash $bash_major is available (brew install bash)."
    return 0
  fi
  if "$bash_bin" "$REPO_ROOT/scripts/check_prerequisites.sh"; then
    ok "All prerequisites verified"
  else
    warn "scripts/check_prerequisites.sh reported problems — see the output above."
  fi
}

write_env_file() {
  local venv_activate="$REPO_ROOT/$VENV_DIR/bin/activate"
  {
    echo "# Generated by scripts/dev_setup.sh — source this to enter the dev environment."
    echo "# Regenerate by re-running: ./scripts/dev_setup.sh"
    if [ -n "${JAVA_HOME:-}" ]; then
      echo "export JAVA_HOME=$(shquote "$JAVA_HOME")"
      echo 'export PATH="$JAVA_HOME/bin:$PATH"'
    fi
    echo "export PATH=$(shquote "$LOCAL_BIN"):\$PATH"
    if [ "${NVM_USED:-0}" -eq 1 ]; then
      echo "export NVM_DIR=$(shquote "${NVM_DIR:-$HOME/.nvm}")"
      echo "[ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && nvm use $(shquote "$NODE_VERSION") >/dev/null"
    fi
    [ -n "$NODE_BIN_DIR" ] && echo "export PATH=$(shquote "$NODE_BIN_DIR")\":\$PATH\""
    if [ "$OS" = macos ] && have brew; then
      local nprefix
      nprefix="$(brew --prefix "node@$NODE_VERSION" 2>/dev/null || true)"
      [ -n "$nprefix" ] && [ -d "$nprefix/bin" ] && echo "export PATH=$(shquote "$nprefix/bin")\":\$PATH\""
    fi
    echo "[ -f $(shquote "$venv_activate") ] && . $(shquote "$venv_activate")"
  } > "$ENV_FILE"
  ok "Wrote $ENV_FILE"
}

configure_mise() {
  have mise || return 0

  # ensure_java runs under `|| true`, so JAVA_HOME can legitimately be unset
  # here; dereferencing it under `set -u` would abort the run after all the
  # work is already done.
  if [ -z "${JAVA_HOME:-}" ]; then
    info "Skipping the checkout-local mise config: Java was not provisioned."
    return 0
  fi

  # An active mise shell hook recalculates JAVA_HOME after every command and can
  # otherwise undo .dev-env.local.sh. Keep the override local to this checkout.
  local mise_paths="\"$JAVA_HOME/bin\""
  [ -n "$NODE_BIN_DIR" ] && mise_paths="$mise_paths, \"$NODE_BIN_DIR\""
  {
    printf '[env]\n'
    printf 'JAVA_HOME = "%s"\n' "$JAVA_HOME"
    printf '_.path = [%s]\n' "$mise_paths"
  } > "$REPO_ROOT/.mise.local.toml"

  if run mise trust -y "$REPO_ROOT/.mise.local.toml"; then
    ok "Configured mise to preserve Java $JAVA_VERSION and Node $NODE_VERSION in this checkout"
  else
    warn "mise could not trust the checkout-local Java/Node configuration."
  fi
}

summary() {
  printf '\n%s%s%s\n' "$C_BOLD" "─────────────────────────────────────────────────────────────" "$C_RESET"
  if [ -n "$WARNINGS" ]; then
    printf '%sSetup finished with warnings:%s\n%s' "$C_YELLOW$C_BOLD" "$C_RESET" "$WARNINGS"
  else
    printf '%sDevelopment environment ready.%s\n' "$C_GREEN$C_BOLD" "$C_RESET"
  fi
  if [ -f "$ENV_FILE" ]; then
    printf '\n%sEnter the environment in a new shell%s\n  source .dev-env.local.sh\n' "$C_BOLD" "$C_RESET"
  else
    printf '\n%sRun the setup%s\n  ./scripts/dev_setup.sh        # add --slim for a fast, connector-free install\n' "$C_BOLD" "$C_RESET"
  fi
  cat <<EOF

${C_BOLD}Build and run${C_RESET}
  mvn clean install -DskipTests                    # backend
  docker compose -f docker/development/docker-compose.yml up -d
  make yarn_start_dev_ui                           # UI on http://localhost:3000
  # server API on http://localhost:8585

${C_BOLD}Day-to-day${C_RESET}
  make generate            # after any openmetadata-spec JSON Schema change
  mvn spotless:apply       # Java formatting
  yarn lint:fix            # UI formatting (run inside the ui/ directory)
  make prerequisites       # re-verify the toolchain
EOF
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
printf '%s\n' "${C_BOLD}OpenMetadata dev environment setup${C_RESET}"
printf '%srepo: %s%s\n' "$C_DIM" "$REPO_ROOT" "$C_RESET"
[ "$CHECK_ONLY" -eq 1 ] && printf '%smode: check only, no changes will be made%s\n' "$C_DIM" "$C_RESET"

step "Detecting platform"
detect_platform

if [ "$DO_TOOLS" -eq 1 ] && [ "$CHECK_ONLY" -eq 0 ]; then
  step "Installing base system packages"
  ensure_homebrew
  install_base_packages
else
  step "Checking base system packages"
  for t in git curl unzip jq make; do
    have "$t" && ok "$t" || warn "$t is not installed."
  done
fi

step "Java $JAVA_VERSION";      ensure_java   || true
step "Maven";                   ensure_maven  || true
step "Node $NODE_VERSION";      ensure_node   || true
step "Yarn (classic)";          ensure_yarn   || true
step "Python >= $PYTHON_MIN";   ensure_python || true
step "ANTLR $ANTLR_VERSION";    ensure_antlr  || true
step "Docker";                  ensure_docker || true

if [ "$CHECK_ONLY" -eq 1 ]; then
  step "Verifying prerequisites"
  run_prerequisite_check
  if [ -x "$VENV_DIR/bin/python" ]; then
    if python_bootstrap_compatible "$VENV_DIR/bin/python"; then
      ok "Virtualenv $VENV_DIR uses Python $(python_mm "$VENV_DIR/bin/python")"
    else
      warn "Virtualenv $VENV_DIR uses Python $(python_mm "$VENV_DIR/bin/python"); re-run setup to rebuild it with Python $PYTHON_PREFERRED."
    fi
  else
    warn "No usable virtualenv at $VENV_DIR."
  fi
  [ -d "ingestion/src/metadata/generated" ] && ok "Generated models present" || warn "ingestion/src/metadata/generated is missing — run 'make generate'."
  [ -d "openmetadata-ui/src/main/resources/ui/node_modules" ] && ok "UI node_modules present" || warn "UI dependencies are not installed."
  [ -f ".git/hooks/pre-commit" ] && ok "pre-commit hook installed" || warn "pre-commit hook is not installed."
  summary
  [ "$WARNING_COUNT" -eq 0 ]
  exit $?
fi

if [ "$DO_PYTHON" -eq 1 ]; then
  step "Python virtualenv ($VENV_DIR)"
  setup_venv
  step "Installing the ingestion framework"
  install_ingestion
else
  info "Skipping Python setup"
  [ -f "$VENV_DIR/bin/activate" ] && . "$VENV_DIR/bin/activate"
fi

if [ "$DO_GENERATE" -eq 1 ]; then
  step "Generating models (JSON Schema -> Pydantic/TS/ANTLR)"
  if [ -n "${VIRTUAL_ENV:-}" ]; then
    generate_models
  else
    warn "Skipping 'make generate': it must run inside the virtualenv."
  fi
fi

if [ "$DO_UI" -eq 1 ]; then
  step "Installing UI dependencies"
  install_ui_deps
fi

if [ "$DO_PRECOMMIT" -eq 1 ] && [ -n "${VIRTUAL_ENV:-}" ]; then
  step "Installing pre-commit hooks"
  install_precommit
elif [ "$DO_PRECOMMIT" -eq 1 ]; then
  warn "Skipping pre-commit hooks: no active virtualenv."
fi

step "Verifying prerequisites"
run_prerequisite_check

step "Writing the environment file"
write_env_file

step "Configuring checkout-local tool versions"
configure_mise

if [ "$DO_BUILD" -eq 1 ]; then
  step "Building the backend (mvn clean install -DskipTests)"
  maven_build
fi

if [ "$DO_DOCKER" -eq 1 ]; then
  step "Starting the local Docker stack"
  start_docker_stack
fi

summary
