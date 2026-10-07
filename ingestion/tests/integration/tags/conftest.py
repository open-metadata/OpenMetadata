#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Native tag sources and backend permission fixtures."""

import json
from uuid import uuid4

import boto3
import pytest
import requests
from sqlalchemy import create_engine, text
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs
from testcontainers.postgres import PostgresContainer

from metadata.generated.schema.api.policies.createPolicy import CreatePolicyRequest
from metadata.generated.schema.api.teams.createRole import CreateRoleRequest
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.role import Role
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig

from ..conftest import _safe_delete  # noqa: TID252
from ..prefect.conftest import prefect_server  # noqa: F401, TID252


@pytest.fixture(scope="module")
def tagged_postgres():
    with PostgresContainer("postgres:16", dbname="demo_db") as container:
        engine = create_engine(container.get_connection_url())
        try:
            with engine.begin() as connection:
                for schema in ("schema_a", "schema_b"):
                    connection.execute(text(f"CREATE SCHEMA {schema}"))
                    connection.execute(text(f"CREATE TABLE {schema}.my_table (id INTEGER)"))
                    for name in ("Shared", "New"):
                        connection.execute(text(f'CREATE POLICY "{name}" ON {schema}.my_table USING (true)'))
            yield {
                "type": "Postgres",
                "username": container.username,
                "authType": {"password": container.password},
                "hostPort": f"{container.get_container_host_ip()}:{container.get_exposed_port(5432)}",
                "database": "demo_db",
            }
        finally:
            engine.dispose()


@pytest.fixture(scope="module")
def tagged_s3():
    with DockerContainer("motoserver/moto:5.0.28").with_exposed_ports(5000) as container:
        wait_for_logs(container, "Running on")
        credentials = {
            "awsAccessKeyId": "testing",
            "awsSecretAccessKey": "testing",
            "awsRegion": "us-east-1",
            "endPointURL": f"http://{container.get_container_host_ip()}:{container.get_exposed_port(5000)}",
        }
        client = boto3.client(
            "s3",
            aws_access_key_id="testing",
            aws_secret_access_key="testing",
            region_name="us-east-1",
            endpoint_url=credentials["endPointURL"],
        )
        buckets = [f"my-bucket-{uuid4().hex[:8]}" for _ in range(2)]
        try:
            for bucket in buckets:
                client.create_bucket(Bucket=bucket)
                client.put_object(Bucket=bucket, Key="my_file.txt", Body=b"Test object")
                client.put_object(
                    Bucket=bucket,
                    Key="openmetadata.json",
                    Body=json.dumps({"entries": [{"dataPath": "", "unstructuredFormats": ["txt"]}]}).encode(),
                )
            yield client, {"type": "S3", "awsConfig": credentials, "bucketNames": buckets}
        finally:
            client.close()


@pytest.fixture(scope="module")
def tagged_prefect(prefect_server):  # noqa: F811
    suffix = uuid4().hex[:8]

    def create(path, payload):
        response = requests.post(f"{prefect_server}/{path}", json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    names = []
    for index, pipeline_tag, task_tag in ((0, "Shared", "New"), (1, "New", "Shared")):
        name = f"tag_flow_{suffix}_{index}"
        names.append(name)
        flow = create("flows/", {"name": name})
        create("deployments/", {"flow_id": flow["id"], "name": "my_deployment", "tags": [pipeline_tag]})
        run = create("flow_runs/", {"flow_id": flow["id"], "state": {"type": "COMPLETED", "name": "Completed"}})
        create(
            "task_runs/",
            {
                "flow_run_id": run["id"],
                "task_key": "extract",
                "name": "extract",
                "dynamic_key": "0",
                "tags": [task_tag],
                "state": {"type": "COMPLETED", "name": "Completed"},
            },
        )
    return {"type": "Prefect", "hostPort": prefect_server, "authType": {"authString": ""}}, names


@pytest.fixture
def tag_writer_without_permissions(metadata):
    created = []
    suffix = uuid4().hex[:8]
    try:
        policy = metadata.create_or_update(
            CreatePolicyRequest(
                name=f"tag_policy_{suffix}",
                rules=[
                    {
                        "name": "DenyTagWrites",
                        "effect": "deny",
                        "operations": ["Create", "EditAll"],
                        "resources": ["tag"],
                    }
                ],
            )
        )
        created.append(policy)
        role = metadata.create_or_update(CreateRoleRequest(name=f"tag_role_{suffix}", policies=[policy.name]))
        created.append(role)
        ingestion_role = metadata.get_by_name(entity=Role, fqn="IngestionBotRole")
        bot = metadata.create_or_update(
            CreateUserRequest(
                name=f"tag_bot_{suffix}",
                email=f"tag_bot_{suffix}@example.com",
                isBot=True,
                roles=[ingestion_role.id, role.id],
                authenticationMechanism={"authType": "JWT", "config": {"JWTTokenExpiry": "OneHour"}},
            )
        )
        created.append(bot)
        token = metadata.client.put(f"/users/generateToken/{bot.id.root}", json={"JWTTokenExpiry": "OneHour"})
        config = metadata.config.model_copy(deep=True)
        config.securityConfig = OpenMetadataJWTClientConfig(jwtToken=token["JWTToken"])
        yield config
    finally:
        for entity in reversed(created):
            _safe_delete(metadata, type(entity), entity.id, recursive=True, hard_delete=True)
