#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import json
import pkgutil
import traceback
from pathlib import Path
from typing import Dict

from airflow import DAG, settings
from airflow.models import DagModel
from flask import escape
from jinja2 import Template
from openmetadata_managed_apis.api.config import (
    AIRFLOW_DAGS_FOLDER,
    DAG_GENERATED_CONFIGS,
    PLUGIN_NAME,
)
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.utils import (
    clean_dag_id,
    get_dagbag,
    import_path,
    scan_dags_job_background,
)
from openmetadata_managed_apis.utils.logger import operations_logger

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory

logger = operations_logger()


class DeployDagException(Exception):
    """
    Error when deploying the DAG
    """


def dump_with_safe_jwt(ingestion_pipeline: IngestionPipeline) -> str:
    """
    Get the dump of the IngestionPipeline but keeping the JWT token masked.

    Since Pydantic V2, we had to handle the serialization of secrets when dumping
    the data at model level, since we don't have anymore fine-grained control of
    it at runtime as we did with V1.

    This means that even if the JWT token is a secret, a model_dump or model_json_dump
    will automatically show the secret value - picking it from the Secrets Manager if enabled.

    With this workaround, we're dumping the model to JSON and then replacing the JWT token
    with the secret, so that if we are using a Secret Manager, the resulting file
    will have the secret ID `secret:/super/secret` instead of the actual value.

    Then, the client will pick up the right secret when the workflow is triggered.
    """
    pipeline_json = ingestion_pipeline.model_dump(mode="json", exclude_defaults=False)
    pipeline_json["openMetadataServerConnection"]["securityConfig"][
        "jwtToken"
    ] = ingestion_pipeline.openMetadataServerConnection.securityConfig.jwtToken.get_secret_value(
        skip_secret_manager=True
    )
    return json.dumps(pipeline_json, ensure_ascii=True)


class DagDeployer:
    """
    Helper class to store DAG config
    and deploy it to Airflow
    """

    def __init__(self, ingestion_pipeline: IngestionPipeline):
        logger.info(
            f"Received the following Airflow Configuration: {ingestion_pipeline.airflowConfig}"
        )
        # we need to instantiate the secret manager in case secrets are passed
        SecretsManagerFactory(
            ingestion_pipeline.openMetadataServerConnection.secretsManagerProvider,
            ingestion_pipeline.openMetadataServerConnection.secretsManagerLoader,
        )
        self.ingestion_pipeline = ingestion_pipeline
        self.dag_id = clean_dag_id(self.ingestion_pipeline.name.root)

    def store_airflow_pipeline_config(
        self, dag_config_file_path: Path
    ) -> Dict[str, str]:
        """
        Store the airflow pipeline config in a JSON file and
        return the path for the Jinja rendering.
        """
        # Create directory if it doesn't exist
        dag_config_file_path.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"Saving file to {dag_config_file_path}")
        with open(dag_config_file_path, "w") as outfile:
            outfile.write(dump_with_safe_jwt(self.ingestion_pipeline))

        return {"workflow_config_file": str(dag_config_file_path)}

    def store_and_validate_dag_file(self, dag_runner_config: Dict[str, str]) -> str:
        """
        Stores the Python file generating the DAG and returns
        the rendered strings
        """

        dag_py_file = Path(AIRFLOW_DAGS_FOLDER) / f"{self.dag_id}.py"

        # Open the template and render
        raw_template = pkgutil.get_data(PLUGIN_NAME, "resources/dag_runner.j2").decode()
        template = Template(raw_template, autoescape=True)

        rendered_dag = template.render(dag_runner_config)

        # Create the DAGs path if it does not exist
        if not dag_py_file.parent.is_dir():
            dag_py_file.parent.mkdir(parents=True, exist_ok=True)

        with open(dag_py_file, "w") as f:
            f.write(rendered_dag)

        try:
            dag_file = import_path(str(dag_py_file))
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to import dag_file [{dag_py_file}]: {exc}")
            raise exc

        if dag_file is None:
            raise DeployDagException(f"Failed to import dag_file [{dag_py_file}]")

        return str(dag_py_file)

    def refresh_session_dag(self, dag_py_file: str):
        """
        Get the stored python DAG file and update the
        Airflow DagBag and sync it to the db.

        In Airflow 2.3.3, we also need to add a call
        to the Scheduler job, to make sure that all
        the pieces are being properly picked up.
        """
        # Refresh dag into session
        with settings.Session() as session:
            try:
                dag_bag = get_dagbag()
                logger.info("dagbag size {}".format(dag_bag.size()))
                found_dags = dag_bag.process_file(dag_py_file)
                logger.info("processed dags {}".format(found_dags))
                dag: DAG = dag_bag.get_dag(self.dag_id, session=session)
                # Sync to DB
                dag.sync_to_db(session=session)
                dag_model = (
                    session.query(DagModel)
                    .filter(DagModel.dag_id == self.dag_id)
                    .first()
                )
                logger.info("dag_model:" + str(dag_model))
            except Exception as exc:
                msg = f"Workflow [{self.dag_id}] failed to refresh due to [{exc}]"
                logger.debug(traceback.format_exc())
                logger.error(msg)
                return ApiResponse.server_error({f"message": msg})

        scan_dags_job_background()

        return ApiResponse.success(
            {"message": f"Workflow [{escape(self.dag_id)}] has been created"}
        )

    def deploy(self):
        """
        Run all methods to deploy the DAG
        """
        dag_config_file_path = Path(DAG_GENERATED_CONFIGS) / f"{self.dag_id}.json"
        logger.info(f"Config file under {dag_config_file_path}")

        dag_runner_config = self.store_airflow_pipeline_config(dag_config_file_path)
        dag_py_file = self.store_and_validate_dag_file(dag_runner_config)
        response = self.refresh_session_dag(dag_py_file)

        return response
