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

"""
Lineage utility for the metadata CLI
"""
import pathlib
import sys
import traceback

from pydantic import BaseModel

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.logger import cli_logger
from metadata.utils.workflow_output_handler import WorkflowType, print_init_error

logger = cli_logger()


class LineageWorkflow(BaseModel):
    filePath: str
    serviceName: str
    workflowConfig: WorkflowConfig


def run_lineage(config_path: str) -> None:
    """
    Run the ingestion workflow from a config path
    to a JSON or YAML file
    :param config_path: Path to load JSON config
    """

    config_file = pathlib.Path(config_path)
    config_dict = None
    try:
        config_dict = load_config_file(config_file)
        workflow = LineageWorkflow.parse_obj(config_dict)
        # logger.debug(f"Using config: {workflow.config}")
    except Exception as exc:
        logger.debug(traceback.format_exc())
        print_init_error(exc, config_dict, WorkflowType.INGEST)
        sys.exit(1)

    with open(workflow.filePath, encoding=UTF_8) as sql_file:
        sql = sql_file.read()
        metadata = OpenMetadata(config=workflow.workflowConfig.openMetadataServerConfig)
        service: DatabaseService = metadata.get_by_name(
            entity=DatabaseService, fqn=workflow.serviceName
        )

        if service:
            connection_type = service.serviceType.value
            add_lineage_request = get_lineage_by_query(
                metadata=metadata,
                service_name=workflow.serviceName,
                dialect=ConnectionTypeDialectMapper.dialect_of(connection_type),
                query=sql,
                database_name=None,
                schema_name=None,
            )
            for lineage_request in add_lineage_request or []:
                resp = metadata.add_lineage(lineage_request)
                entity_name = resp.get("entity", {}).get("name")
                for node in resp.get("nodes", []):
                    logger.info(
                        f"added lineage between table {node.get('name')} and {entity_name} "
                    )

        else:
            logger.error(f"Service not found with name {workflow.filePath}")
