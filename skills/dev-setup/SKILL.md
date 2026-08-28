---
name: dev-setup
description: Set up, verify, or repair a local OpenMetadata development environment on macOS or Linux. Installs the toolchain (Java 21, Maven, Node 22, Yarn 1.x, Python 3.10+, ANTLR 4.9.2, Docker), creates the Python venv, generates models, installs UI dependencies and pre-commit hooks. Use for a fresh clone, a new worktree, onboarding, or when a build fails with a missing/wrong tool.
user-invocable: true
argument-hint: "[--check] [--slim] [--with-build] [--with-docker] [-y]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Dev Environment Setup

Bring a checkout from "just cloned" to "can build the backend, the UI, and the ingestion
framework" with one call.

## When to Activate

- "set up my dev environment", "onboard me", "I just cloned this repo"
- "set up this worktree" (a Claude Code worktree does **not** inherit the main repo's venv)
- A build fails on a missing or wrong-version tool: `antlr4: command not found`,
  `class file has wrong version`, `Unsupported engine … node`, `ModuleNotFoundError: metadata.generated`
- "check my environment", "why doesn't `make generate` work"

## The One Call

```bash
./scripts/dev_setup.sh          # or: make dev_setup
```

Everything is idempotent — re-running skips what is already correct. Useful flags
(pass through the Makefile as `make dev_setup ARGS="--slim -y"`):

| Flag | Effect |
|---|---|
| `--check` | Diagnose only, change nothing. Returns nonzero when issues are found. **Always start here** on an existing checkout. |
| `--slim` | Install `ingestion[dev]` instead of `[all-dev-env]`. Minutes instead of tens of minutes; omits most connector deps. Right choice unless the work touches a specific connector. |
| `-y` | Non-interactive (assumes yes for Homebrew/nvm/Docker prompts). |
| `--with-build` | Also runs `mvn clean install -DskipTests -T 1C`. |
| `--with-docker` | Also starts `docker/development/docker-compose.yml`. |
| `--skip-tools` | Verify system packages instead of installing them (no sudo/brew writes). |
| `--skip-python` / `--skip-ui` / `--skip-generate` / `--skip-precommit` | Skip that phase. |
| `--python <bin>` | Force the interpreter the venv is built from. |

## Process

### Step 1 — Diagnose before changing anything

```bash
./scripts/dev_setup.sh --check
```

Read the warnings. They name the exact missing piece; do not install anything the check
reports as already present.

### Step 2 — Choose the depth

- Backend/UI work only, or a new worktree → `./scripts/dev_setup.sh --slim -y`
- Connector or ingestion work → `./scripts/dev_setup.sh -y` (full `[all-dev-env]`)
- Ask the user before running the full install if they are on a metered/slow link — it
  downloads every connector's dependencies.

### Step 3 — Enter the environment

The script writes `.dev-env.local.sh` (gitignored) at the repo root:

```bash
source .dev-env.local.sh
```

It exports `JAVA_HOME`, puts `~/.local/bin` (the ANTLR CLI) and the right Node on `PATH`,
and activates the venv. Tell the user to source it in each new shell, or add it to their
shell rc.

### Step 4 — Verify with real commands

Do not claim success without output. Minimum bar:

```bash
source .dev-env.local.sh
make prerequisites                              # all ✓
python -c "import metadata.generated.schema.entity.data.table"   # models generated
mvn -q -pl openmetadata-spec install -DskipTests                 # backend toolchain
cd openmetadata-ui/src/main/resources/ui && yarn tsc --noEmit --version  # UI deps
```

## What the script actually does

1. Detects platform → `brew` / `apt` / `dnf` / `yum` / `pacman` / `zypper`.
2. Installs the build toolchain plus the headers the ingestion wheels compile against
   (libffi, openssl, sasl/gssapi, krb5, libpq, librdkafka, unixodbc, libxml2/xslt).
3. Ensures Java 21, Maven ≥ 3.6, Node 22, Yarn 1.x, Python ≥ 3.10, ANTLR 4.9.2, Docker.
4. Creates `env/`, then runs the CLAUDE.md bootstrap sequence:
   `make install_dev_env` → `make generate` → `make yarn_install_cache` →
   `make install_test precommit_install` → `make prerequisites`.
5. Writes `.dev-env.local.sh` and, when mise is active, a gitignored `.mise.local.toml` so mise's
   shell hook does not restore incompatible global Java/Node versions.

## Troubleshooting

### Maven fails with `TypeTag :: UNKNOWN`

This usually means Maven is running on a newer JDK even though Java 21 is installed. Run the setup
again and source `.dev-env.local.sh`; the generated environment places `$JAVA_HOME/bin` first on
`PATH`. When mise is installed, setup also writes `.mise.local.toml`, preventing mise's prompt hook
from immediately restoring a newer global JDK.

**`make prerequisites` fails on macOS with "declare -A is not supported"**
`scripts/check_prerequisites.sh` needs bash ≥ 4; macOS ships 3.2. `brew install bash`
(the setup script does this and then runs the check through the brew bash).

**`java: command not found` after installing on macOS**
Homebrew's `openjdk@21` is keg-only — never symlinked onto `PATH`. Use
`export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"` and put
`$JAVA_HOME/bin` first. `.dev-env.local.sh` already does this.

**`antlr4: command not found`, or generated parsers are rejected at runtime**
The ANTLR CLI must be exactly **4.9.2** — it has to match the pinned
`antlr4-python3-runtime` and the JS runtime. A distro `antlr4` of any other version
produces parsers those runtimes reject. Fix:
`make install_antlr_cli ANTLR_INSTALL_DIR="$HOME/.local/bin"` (checksum-pinned, no sudo).

**`make generate` fails or silently produces nothing**
It must run inside the venv (`source env/bin/activate`) and only from the **repo root** —
it is a root-only target and does not exist under `ingestion/`. It wipes and rebuilds
`ingestion/src/metadata/generated`, so a partial run leaves an unimportable tree; re-run it
rather than hand-patching.

**Node is not version 22**
Some distro releases provide Node 18/20 while rolling installations may already have Node 24/26.
The current UI tree includes `i18next-parser@9.4.0`, which accepts Node 18, 20, or 22 and rejects
newer majors. The script uses `mise` when it is already installed, otherwise it falls back to a
user-local `nvm` install of Node 22 — neither path needs root. Re-source `.dev-env.local.sh`
afterwards.

**Yarn resolves to 3.x/4.x (Berry)**
This repo is Yarn Classic (`engines.yarn: ^1.22.0`). `npm i -g yarn@1.22.22`. A Berry yarn
will fail `yarn install --frozen-lockfile`.

**spaCy/Thinc/Blis fails while installing build dependencies on Python 3.13/3.14**
The project metadata has no Python ceiling, but the current native dev dependency versions do not
publish wheels for those minors and their fallback source build fails. The setup script uses Python
3.11 by default and currently builds its venv only with Python 3.10–3.12. Re-run the setup; it will
offer to rebuild an incompatible existing `env/` and provision Python 3.11 through `uv` if needed.

**`cx_Oracle` fails to build**
It is installed deliberately with `--no-build-isolation` (see `ingestion/Makefile`). Use the
make targets rather than a bare `pip install`.

**Docker daemon unreachable on Linux**
`sudo systemctl enable --now docker` and `sudo usermod -aG docker $USER`, then log out and
back in — group membership is not picked up by the current shell.

**Claude Code worktree has no venv**
Worktrees do not copy `env/`. Either run `./scripts/dev_setup.sh --slim` inside the
worktree, or symlink the main repo's: `ln -s /path/to/main-repo/env env`.

**`--skip-tools` and still failing**
The user may not have sudo. Report exactly which packages are missing and the one-line
install command for their manager; do not attempt privileged installs they did not approve.

## Guardrails

- Never run the script with `sudo`. It escalates only for the specific package-manager
  calls that need it.
- Do not edit `.dev-env.local.sh` by hand — it is regenerated on every run.
- Do not `pip install` ingestion dependencies directly; use the `make` targets so the
  pins (`setuptools<81`, `cx_Oracle` build isolation) are honored.
- If a step fails, surface the real command output. Do not report "environment ready"
  from a run that produced warnings.
