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
OpenMetadata Airflow Lineage Backend
"""

import ast
import json
import os
import traceback
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Set, Union

from airflow.configuration import conf
from airflow.lineage.backend import LineageBackend

from airflow_provider_openmetadata.lineage.config import (
    OpenMetadataLineageConfig,
    get_lineage_config,
    get_metadata_config,
)
from airflow_provider_openmetadata.lineage.utils import (
    ALLOWED_FLOW_KEYS,
    ALLOWED_TASK_KEYS,
    create_pipeline_entity,
    get_or_create_pipeline_service,
    get_properties,
    get_xlets,
    is_airflow_version_1,
    parse_lineage_to_openmetadata,
)
from metadata.config.common import ConfigModel
from metadata.generated.schema.api.data.createPipeline import (
    CreatePipelineEntityRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceEntityRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import convert_epoch_to_iso

if TYPE_CHECKING:
    from airflow import DAG
    from airflow.models.baseoperator import BaseOperator


class OpenMetadataLineageBackend(LineageBackend):
    """
    Sends lineage data from tasks to OpenMetadata.

    Configurable via ``airflow_provider_openmetadata.cfg`` as follows: ::
    [lineage]
    backend = airflow_provider_openmetadata.lineage.OpenMetadataLineageBackend
    airflow_service_name = airflow #make sure this service_name matches
        the one configured in openMetadata
    openmetadata_api_endpoint = http://localhost:8585
    auth_provider_type = no-auth # use google here if you are
        configuring google as SSO
    secret_key = google-client-secret-key # it needs to be configured
        only if you are using google as SSO
    """

    def __init__(self) -> None:
        super().__init__()
        _ = get_lineage_config()

    @staticmethod
    def send_lineage(
        operator: "BaseOperator",
        inlets: Optional[List] = None,
        outlets: Optional[List] = None,
        context: Dict = None,
    ) -> None:

        try:
            config = get_lineage_config()
            metadata_config = get_metadata_config(config)
            client = OpenMetadata(metadata_config)

            op_inlets = get_xlets(operator, "_inlets")
            op_outlets = get_xlets(operator, "_outlets")

            parse_lineage_to_openmetadata(
                config, context, operator, op_inlets, op_outlets, client
            )
        except Exception as exc:  # pylint: disable=broad-except
            operator.log.error(traceback.format_exc())
            operator.log.error(exc)
