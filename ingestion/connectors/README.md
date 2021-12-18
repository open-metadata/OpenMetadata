# Ingestion Framework Connectors

Directory containing the necessary Dockerfiles to prepare the images that will hold the Connectors' code.

These images can then be used either in isolation or as `DockerOperator` in Airflow ingestions.

- `Dockerfile-base` contains the minimum basic requirements for all Connectors, i.e., the ingestion framework with the base requirements.

All the connector's images will be based on this basic image, and they will only add the necessary extra dependencies to run their own connector.

The Connector images will be named `ingestion-connector-${connectorName}`.

## Process

- We first need to build the base image `make build_docker_base`
- Then, we will build the connectors `make build_docker_connectors`
- Optionally, we can push the connectors' images to Dockerhub with `make push_docker_connectors`

We can then use the `DockerOperator` in Airflow as follows:

```python
ingest_task = DockerOperator(
    task_id="ingest_using_docker",
    image="openmetadata/ingestion-connector-base",
    command="python main.py",
    environment={
        "config": config
    },
    tty=True,
    auto_remove=True,
    mounts=[
        Mount(
            source='/tmp/openmetadata/examples/',
            target='/opt/operator/',
            type='bind'
        ),
    ],
    mount_tmp_dir=False,
    network_mode="host",  # Needed to reach Docker OM
)
```

Note that the `config` object should be a `str` representing the JSON connector
configuration. The connector images have been built packaging a `main.py` script that
will load the `config` environment variable and pass it to the `Workflow`.

## Configs

Note that in the example DAG for `airflow_sample_data.py` we are passing the `config` object with `"sample_data_folder": "/opt/operator/sample_data"`.

In the DAG definition we are mounting a volume with the `examples` data to `/opt/operator/` in the `DockerOperator`. A symlink is being generated in `run_local_docker.sh`.

Note that these specific configurations are just needed in our development/showcase DAG because of specific infra requirements. Each architecture will need to prepare its own volume and network settings.
