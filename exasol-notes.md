# Exasol Development Dev Notes


## Development Environment

All dependencies and tools required for development (except Python), according to `make prerequisites`, are provided by the Nix flake `flake.nix`.

This environment can be activated by running the following command:

```shell
nix develop
```

Regarding Python, you are free to choose whatever fits your needs best. During development, Rye was used for providing and managing the Python version
(`.python-version`). For development itself, a virtual Python environment was used. In any case, make sure you have an appropriate Python environment
and have activated it so the path, etc., are set correctly, e.g., via:

```shell
source .venv/bin/activate.fish
```
