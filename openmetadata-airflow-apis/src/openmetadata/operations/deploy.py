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

import logging
import traceback
from pathlib import Path
from typing import Dict

from airflow import settings
from airflow.models import DagBag, DagModel
from airflow.models.serialized_dag import SerializedDagModel
from jinja2 import Template
from openmetadata.api.config import (
    AIRFLOW_DAGS_FOLDER,
    DAG_GENERATED_CONFIGS,
    DAG_RUNNER_TEMPLATE,
    HOSTNAME,
)
from openmetadata.api.response import ApiResponse
from openmetadata.api.utils import import_path

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.ingestion.models.encoders import show_secrets_encoder


class DeployDagException(Exception):
    """
    Error when deploying the DAG
    """


class DagDeployer:
    """
    Helper class to store DAG config
    and deploy it to Airflow
    """

    def __init__(self, ingestion_pipeline: IngestionPipeline, dag_bag: DagBag):

        logging.info(
            f"Received the following Airflow Configuration: {ingestion_pipeline.airflowConfig}"
        )

        self.ingestion_pipeline = ingestion_pipeline
        self.dag_bag = dag_bag

    def store_airflow_pipeline_config(
        self, dag_config_file_path: Path
    ) -> Dict[str, str]:
        """
        Store the airflow pipeline config in a JSON file and
        return the path for the Jinja rendering.
        """

        logging.info(f"Saving file to {dag_config_file_path}")
        with open(dag_config_file_path, "w") as outfile:
            outfile.write(self.ingestion_pipeline.json(encoder=show_secrets_encoder))

        return {"workflow_config_file": str(dag_config_file_path)}

    def store_and_validate_dag_file(self, dag_runner_config: Dict[str, str]) -> str:
        """
        Stores the Python file generating the DAG and returns
        the rendered strings
        """

        dag_py_file = (
            Path(AIRFLOW_DAGS_FOLDER) / f"{self.ingestion_pipeline.name.__root__}.py"
        )

        # Open the template and render
        with open(DAG_RUNNER_TEMPLATE, "r") as f:
            template = Template(f.read())

        rendered_dag = template.render(dag_runner_config)

        # Create the DAGs path if it does not exist
        if not dag_py_file.parent.is_dir():
            dag_py_file.parent.mkdir(parents=True, exist_ok=True)

        with open(dag_py_file, "w") as f:
            f.write(rendered_dag)

        try:
            dag_file = import_path(str(dag_py_file))
        except Exception as exc:
            logging.error(f"Failed to import dag_file {dag_py_file} due to {exc}")
            raise exc

        if dag_file is None:
            raise DeployDagException(f"Failed to import dag_file {dag_py_file}")

        return str(dag_py_file)

    def refresh_session_dag(self, dag_py_file: str):
        """
        Get the stored python DAG file and update the
        Airflow DagBag and sync it to the db
        """
        # Refresh dag into session
        session = settings.Session()
        try:
            logging.info("dagbag size {}".format(self.dag_bag.size()))
            found_dags = self.dag_bag.process_file(dag_py_file)
            logging.info("processed dags {}".format(found_dags))
            dag = self.dag_bag.get_dag(
                self.ingestion_pipeline.name.__root__, session=session
            )
            SerializedDagModel.write_dag(dag)
            dag.sync_to_db(session=session)
            dag_model = (
                session.query(DagModel)
                .filter(DagModel.dag_id == self.ingestion_pipeline.name.__root__)
                .first()
            )
            logging.info("dag_model:" + str(dag_model))

            return ApiResponse.success(
                {
                    "message": f"Workflow [{self.ingestion_pipeline.name.__root__}] has been created"
                }
            )
        except Exception as exc:
            logging.info(f"Failed to serialize the dag {exc}")
            return ApiResponse.server_error(
                {
                    "message": f"Workflow [{self.ingestion_pipeline.name.__root__}] failed to refresh due to [{exc}] "
                    + f"- {traceback.format_exc()}"
                }
            )

    def deploy(self):
        """
        Run all methods to deploy the DAG
        """
        dag_config_file_path = (
            Path(DAG_GENERATED_CONFIGS)
            / f"{self.ingestion_pipeline.name.__root__}.json"
        )
        logging.info(f"Config file under {dag_config_file_path}")

        dag_runner_config = self.store_airflow_pipeline_config(dag_config_file_path)
        dag_py_file = self.store_and_validate_dag_file(dag_runner_config)
        response = self.refresh_session_dag(dag_py_file)

        return response
