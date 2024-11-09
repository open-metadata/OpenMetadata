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
import sys
import traceback
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8
from metadata.utils.logger import cli_logger, redacted_config
from metadata.workflow.workflow_init_error_handler import WorkflowInitErrorHandler

logger = cli_logger()


class LineageWorkflow(BaseModel):
    filePath: Optional[str] = None
    query: Optional[str] = None
    checkPatch: Optional[bool] = True
    serviceName: str
    workflowConfig: WorkflowConfig
    parseTimeout: Optional[int] = 5 * 60  # default parsing timeout to be 5 mins


def run_lineage(config_path: Path) -> None:
    """
    Run the ingestion workflow from a config path
    to a JSON or YAML file
    :param config_path: Path to load JSON config
    """

    config_dict = None
    try:
        config_dict = load_config_file(config_path)
        logger.debug("Using workflow config:\n%s", redacted_config(config_dict))
        workflow = LineageWorkflow.model_validate(config_dict)

    except Exception as exc:
        logger.debug(traceback.format_exc())
        WorkflowInitErrorHandler.print_init_error(
            exc, config_dict, PipelineType.lineage
        )
        sys.exit(1)

    if workflow.filePath:
        with open(workflow.filePath, encoding=UTF_8) as sql_file:
            sql = sql_file.read()
    else:
        sql = workflow.query

    metadata = OpenMetadata(config=workflow.workflowConfig.openMetadataServerConfig)
    service: DatabaseService = metadata.get_by_name(
        entity=DatabaseService, fqn=workflow.serviceName
    )
    if service:
        metadata.add_lineage_by_query(
            database_service=service,
            timeout=workflow.parseTimeout,
            sql=sql,
            check_patch=workflow.checkPatch,
        )
    else:
        logger.error(f"Service not found with name {workflow.serviceName}")
