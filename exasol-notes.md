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




# Local OpenMetadata Setup

- Start Test Containers

    ```shell
    docker compose docker/development/docker-compose.yml    
    ```

- Kill All Containers (Not Only the OpenMetadata Ones)

    ```shell
    docker rm -f $(docker ps -a -q)
    ```

## Passwords

### MySql
port: 3306
- user: openmetadata_user
- password: openmetadata_password

### Open Metadata
url: http://127.0.0.1:8585
- user: admin@openmetadata.org
- password: admin

### Airflow
url: http://127.0.0.1:8080/
- user: admin
- password: admin
