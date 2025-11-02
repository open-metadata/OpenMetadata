# UV Setup for OpenMetadata Ingestion

This document provides setup instructions for using UV with the OpenMetadata ingestion package.

## Prerequisites

### macOS Setup

If you encounter build errors with `mysqlclient` (required by `pydoris`), install MySQL client libraries:

```bash
# Install MySQL and pkg-config via Homebrew
brew install mysql pkg-config

# Add to your shell profile (e.g., ~/.zshrc)
export PKG_CONFIG_PATH="/opt/homebrew/lib/pkgconfig:/opt/homebrew/opt/mysql/lib/pkgconfig:$PKG_CONFIG_PATH"

# Reload your shell or source the profile
source ~/.zshrc
```

### Ubuntu/Debian Setup

For CI/CD and Ubuntu environments:

```bash
sudo apt-get update && sudo apt-get install -y \
    libmysqlclient-dev \
    pkg-config \
    python3-dev \
    build-essential
```

## UV Commands

The project includes convenient Makefile targets for UV:

```bash
# Create .venv and install development dependencies
make uv_setup

# Sync dependencies (uses uv.lock if available)
make uv_sync

# Sync all dependencies including extras
make uv_sync_all

# Sync with frozen lock file (CI/CD - exact reproducible builds)
make uv_sync_frozen

# Update the lock file
make uv_lock

# Show all available targets
make help
```

## Manual UV Commands

You can also use UV directly:

```bash
# Install and use specific Python version (modern uv approach)
uv python install 3.11
uv python pin 3.11

# Create virtual environment (auto-detects Python version)
uv venv .venv

# Sync with specific extras
uv sync --extra dev --extra test

# Sync with all extras
uv sync --extra all --extra test --extra dev

# Sync with frozen lock file (CI/CD)
uv sync --frozen

# Install specific extras
uv pip install -e ".[great-expectations]"

# Update lock file
uv lock
```

## Troubleshooting

### MySQL Client Build Issues

If you see errors like:
```
Exception: Can not find valid pkg-config name.
Specify MYSQLCLIENT_CFLAGS and MYSQLCLIENT_LDFLAGS env vars manually
```

Follow the macOS or Ubuntu setup instructions above.

### Virtual Environment Issues

If you have environment issues, clean up and recreate:

```bash
rm -rf .venv
make uv_setup
```

## Benefits of UV

- **Speed**: Significantly faster than pip for dependency resolution and installation
- **Lock Files**: Reproducible builds with `uv.lock`
- **Better Caching**: Superior dependency caching
- **Modern Resolver**: More efficient dependency resolution

## Docker Usage

The `Dockerfile.ci` has been updated to use modern uv patterns:

```dockerfile
# Configure uv to use system Python
ENV UV_SYSTEM_PYTHON=1

# Use uv sync for production builds
RUN uv sync --locked --no-dev
```

### Benefits in Docker:
- **Faster Builds**: uv is significantly faster than pip
- **Reproducible**: `--locked` ensures exact dependency versions  
- **Production Ready**: `--no-dev` excludes development dependencies
- **Cache Friendly**: Better layer caching with uv