# OpenMetadata Ingestion Docker Operator

Utilities required to handle metadata ingestion in Airflow using `DockerOperator`.

The whole idea behind this approach is to avoid having to install packages directly
in any Airflow host, as this adds many (unnecessary) constraints to be aligned
on the `openmetadata-ingestion` package just to have the Python installation
as a `virtualenv` within the Airflow host.

The proposed solution - or alternative approach - is to use the
[DockerOperator](https://airflow.apache.org/docs/apache-airflow-providers-docker/stable/_api/airflow/providers/docker/operators/docker/index.html)
and run the ingestion workflows dynamically.

This requires the following:
- Docker image with the bare `openmetadata-ingestion` requirements,
- `main.py` file to execute the `Workflow`s,
- Handling of environment variables as input parameters for the operator.

Note that Airflow's Docker Operator works as follows (example from [here](https://github.com/apache/airflow/blob/providers-docker/3.0.0/tests/system/providers/docker/example_docker.py)):

```python
DockerOperator(
    docker_url='unix://var/run/docker.sock',  # Set your docker URL
    command='/bin/sleep 30',
    image='centos:latest',
    network_mode='bridge',
    task_id='docker_op_tester',
    dag=dag,
)
```

We need to provide as ingredients:
1. Docker image to execute,
2. And command to run.

This is not a Python-first approach, and therefore it is not allowing us to set a base image and pass a Python function
as a parameter (which would have been the preferred approach). Instead, we will leverage the `environment` input
parameter of the `DockerOperator` and pass all the necessary information in there.

Our `main.py` Python file will then be in charge of:
1. Loading the workflow configuration from the environment variables,
2. Get the required workflow class to run and finally,
3. Execute the workflow.
