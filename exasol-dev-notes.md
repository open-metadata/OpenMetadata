# Exasol Connector Dev Notes


## Development Environment

To simplify and avoid conflicts with local tooling, the `installation` of required tools for Open Metadata development has been done using a nix flake. Further details on nix can be found on the nix [homepage](https://nixos.org). If, for any reason, you want to set up the Open Metadata tooling differently, feel free to do so. If you want to use the nix flake, executing the command below should provide an appropriate shell for development.

```shell
nix develop
```

This nix environment will contain all necessary tools except the required Python interpreter and setup. This was intentionally done to give developers maximum flexibility in choosing how and which Python they want to use (changing and adjusting the Python environment provided by nix can be a bit tricky).

As of writing this, [Rye](https://rye.astral.sh) was used for providing and managing the Python version (`.python-version`). For the development itself, a virtual Python environment was used.
In any case, make sure you have an appropriate Python environment and have activated it so the path, etc., are set correctly, e.g., via:

```shell
source .venv/bin/activate.fish
```

Once you have activated the nix environment and sourced the appropriate Python environment within it, Open-Metadata's `make prerequisites` should pass all checks.

⚠️ Note, The following things should be removed from the changeset before attempting to make an offical PR into the Open-Metadata repository:

    * This Development Notes (`exasol-dev-notes.md`)
    * The nix falke (`flake.nix`, `flake.lock`) 
    * Traces of Rye (`.python-version`)
    * Test file for the connector (`exasol.yaml`) or move to appropriate place
    * Test file for the connector (`debug_om_connector.py`) or move to appropriate place

### Known Issues

There is an issue with invalid JSON API if one tries to run the built open-metadata Java binary within the Nix development environment. This stems from the fact that ANTLR is part of the development environment, which also brings the JSON library used by open-metadata, but in another incompatible API version. When the Nix development environment is sourced, these classes seem to be found within the Java `classpath`, which then gets picked up by the open-metadata binary, causing it to fail.

To avoid this, it is recommended to have a different environment for execution, e.g., by creating a temporary one by running:

```shell
nix-shell -p jdk17
```

This should fix the issue. 

⚠️ Attention: Be sure you do not source the temporary environment on top of the development environment!

## Resources

* [Open-Metadata Documentation](https://docs.open-metadata.org/latest)
* Video tutorials
    - []()
* [Doris datasource PR](https://github.com/open-metadata/OpenMetadata/pull/14087/files)


## Local OpenMetadata Setup

### Start Test Containers

```shell
docker compose docker/development/docker-compose.yml    
```

### Kill All Containers (Not Only the OpenMetadata Ones)

```shell
docker rm -f $(docker ps -a -q)
```

### Services

#### MySQL
| Property  | Value                   |
|-----------|-------------------------|
| port      | 3306                    |
| user      | openmetadata_user       |
| password  | openmetadata_password   |

#### Open Metadata
| Property  | Value                       |
|-----------|-----------------------------|
| url       | http://127.0.0.1:8585       |
| user      | admin@openmetadata.org      |
| password  | admin                       |

#### Airflow
| Property  | Value                     |
|-----------|---------------------------|
| url       | http://127.0.0.1:8080/    |
| user      | admin                     |
| password  | admin                     |


## Debugging Setup
TBD


## Status

### Reached out to Open-Metadata Project
* Emailed: [Sriharsha Chintalapani](mailto:harsha@getcollate.io)
* [OM-Slack-Community](https://slack.open-metadata.org/)
    - Search for posts by user `nicoretti`, e.g., `Search: from:@nicoretti`

### Implementation (Status)
* Set up/Create basic development environment
* Documented development environment
* Added schemas for Exasol connector
* Added definitions for DB service
* Created [Draft PR:#17166](https://github.com/open-metadata/OpenMetadata/pull/17166)
* Added Exasol connector to OpenMetadata UI
* Added ingestion code stubs
* Added basic documentation for Exasol connector
* Added debug/test config
* Added debug script

## Notes

### Logging
* `ingestion/build/lib/metadata/utils/logger.py` provides functions to retrieve a logger

## Questions
- What would be a good and easy standard workflow file for testing?
- Where is the best place to put a test that checks the connection and connection parameters specifically for a connector?
    - `ingestion/tests/unit/connections/test_test_connections.py`
    - `ingestion/tests/unit/connection_builders.py` (MySQL only?)
    - `ingestion/tests/unit/test_source_connection.py`
    - `ingestion/tests/unit/test_source.py`
    - Are there other tests relevant when it comes to connection?
- How and where should I setup my connection test? 
    - Unit test(s): Parameters passed along correctly
    - Integration test(s): Connection is/can be established successfully
    - Is there a specific place for adding tests for connectors?
