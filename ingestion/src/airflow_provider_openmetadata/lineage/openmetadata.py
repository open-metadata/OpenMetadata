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

import traceback
from typing import TYPE_CHECKING, Dict, List, Optional

from airflow.lineage.backend import LineageBackend

from airflow_provider_openmetadata.lineage.config.loader import (
    AirflowLineageConfig,
    get_lineage_config,
)
from airflow_provider_openmetadata.lineage.utils import get_xlets, parse_lineage
from metadata.ingestion.ometa.ometa_api import OpenMetadata

if TYPE_CHECKING:
    from airflow.models.baseoperator import BaseOperator


# pylint: disable=too-few-public-methods
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
        only if you are using google as SSO the one configured in openMetadata
    openmetadata_api_endpoint = http://localhost:8585
    auth_provider_type = no-auth # use google here if you are configuring google as SSO
    secret_key = google-client-secret-key # it needs to be configured
                 only if you are using google as SSO
    """

    def __init__(self) -> None:
        """
        Instantiate a superclass object and run lineage config function
        """
        super().__init__()
        _ = get_lineage_config()

    # pylint: disable=protected-access
    @staticmethod  # needed for Airflow 1.10.x
    def send_lineage(
        operator: "BaseOperator",
        inlets: Optional[List] = None,
        outlets: Optional[List] = None,
        context: Dict = None,
    ) -> None:
        """
        Send lineage to OpenMetadata

        Args
            operator (BaseOperator):
            inlets (Optional[List]):
            outlets (Optional[List]):
            context (Dict):
        Returns
            None
        """

        try:
            config: AirflowLineageConfig = get_lineage_config()
            metadata = OpenMetadata(config.metadata_config)

            op_inlets = get_xlets(operator, "_inlets")
            op_outlets = get_xlets(operator, "_outlets")

            parse_lineage(config, context, operator, op_inlets, op_outlets, metadata)
        except Exception as exc:  # pylint: disable=broad-except
            operator.log.error(traceback.format_exc())
            operator.log.error(exc)
