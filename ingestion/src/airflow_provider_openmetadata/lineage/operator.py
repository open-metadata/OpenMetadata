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
OpenMetadata Airflow Lineage Operator
"""
import traceback
from typing import List

from airflow.models.baseoperator import BaseOperator
from airflow.utils.context import Context

from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
    XLets,
    get_xlets_from_dag,
)


class OpenMetadataLineageOperator(BaseOperator):
    """
    This Operator will check the inlets and outlets of its DAG
    and push the lineage to OpenMetadata.

    It requires the OpenMetadataConnection to be passed as
    an argument to instantiate the ometa client.

    if `only_keep_dag` is True, we will remove any lineage related
    to the DAG that is not part of the inlets/outlets of its tasks.
    """

    def __init__(
        self,
        server_config: OpenMetadataConnection,
        service_name: str,
        only_keep_dag_lineage: bool = False,
        max_status: int = 10,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self.server_config = server_config
        self.service_name = service_name
        self.only_keep_dag_lineage = only_keep_dag_lineage
        self.max_status = max_status

    def execute(self, context: Context) -> None:
        """
        Main logic to check the context for lineage
        and push it to OpenMetadata using the Python Client.
        """
        try:
            xlet_list: List[XLets] = get_xlets_from_dag(self.dag)

            self.dag.log.info(
                f"Extracted the following XLet data from the DAG: {xlet_list}"
            )

            metadata = OpenMetadata(self.server_config)
            runner = AirflowLineageRunner(
                metadata=metadata,
                service_name=self.service_name,
                dag=self.dag,
                xlets=xlet_list,
                only_keep_dag_lineage=self.only_keep_dag_lineage,
                max_status=self.max_status,
            )

            runner.execute()
        except Exception as err:
            self.dag.log.info(traceback.format_exc())
            self.dag.log.error(f"Error executing the lineage runner - {err}")
            raise err
