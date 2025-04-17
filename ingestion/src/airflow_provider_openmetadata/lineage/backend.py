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

"""
OpenMetadata Airflow Lineage Backend
"""

import traceback
from typing import Dict, List, Optional

from airflow.lineage.backend import LineageBackend

from airflow_provider_openmetadata.lineage.config.loader import (
    AirflowLineageConfig,
    get_lineage_config,
)
from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    XLets,
    get_xlets_from_dag,
)


# pylint: disable=too-few-public-methods
class OpenMetadataLineageBackend(LineageBackend):
    """
    Sends lineage data from tasks to OpenMetadata.

    Configurable via `airflow.cfg` as follows:

    [lineage]
    backend = airflow_provider_openmetadata.lineage.backend.OpenMetadataLineageBackend
    airflow_service_name = airflow
    openmetadata_api_endpoint = http://localhost:8585/api
    jwt_token = <token>  # To auth to the OpenMetadata API
    """

    def send_lineage(
        self,
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
            dag = context["dag"]
            dag.log.info("Executing OpenMetadata Lineage Backend...")

            config: AirflowLineageConfig = get_lineage_config()
            xlet_list: List[XLets] = get_xlets_from_dag(dag)
            metadata = OpenMetadata(config.metadata_config)

            runner = AirflowLineageRunner(
                metadata=metadata,
                service_name=config.airflow_service_name,
                dag=dag,
                xlets=xlet_list,
                only_keep_dag_lineage=config.only_keep_dag_lineage,
                max_status=config.max_status,
            )
            runner.execute()

        except Exception as exc:  # pylint: disable=broad-except
            operator.log.error(traceback.format_exc())
            operator.log.error(exc)
