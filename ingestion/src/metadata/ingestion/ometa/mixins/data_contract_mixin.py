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
Mixin class containing Data Contract specific methods

To be used by OpenMetadata class
"""
import traceback
from typing import Optional

from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.generated.schema.entity.datacontract.dataContractResult import (
    DataContractResult,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaDataContractMixin:
    """
    OpenMetadata API methods related to Data Contracts.
    To be inherited by OpenMetadata
    """

    client: REST

    def put_data_contract_result(
        self, data_contract_id: Uuid, result: DataContractResult
    ) -> Optional[DataContractResult]:
        """
        Create or update a data contract execution result

        Args:
            data_contract_id: UUID of the data contract
            result: DataContractResult object containing execution details

        Returns:
            DataContractResult if successful, None otherwise
        """
        try:
            resp = self.client.put(
                f"{self.get_suffix(DataContract)}/{data_contract_id.root}/results",
                data=result.model_dump_json(),
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error creating data contract result for {data_contract_id}: {err}"
            )
        return None

    def get_data_contract_results(
        self,
        data_contract_id: Uuid,
        limit: int = 10,
        start_ts: Optional[int] = None,
        end_ts: Optional[int] = None,
    ) -> Optional[list]:
        """
        Get data contract execution results

        Args:
            data_contract_id: UUID of the data contract
            limit: Maximum number of results to return
            start_ts: Start timestamp filter
            end_ts: End timestamp filter

        Returns:
            List of DataContractResult objects if successful, None otherwise
        """
        try:
            params = {"limit": limit}
            if start_ts:
                params["startTs"] = start_ts
            if end_ts:
                params["endTs"] = end_ts

            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/{data_contract_id}/results",
                params=params,
            )
            if resp:
                return [DataContractResult(**result) for result in resp.get("data", [])]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting data contract results for {data_contract_id}: {err}"
            )
        return None

    def get_latest_data_contract_result(
        self, data_contract_id: Uuid
    ) -> Optional[DataContractResult]:
        """
        Get the latest data contract execution result

        Args:
            data_contract_id: UUID of the data contract

        Returns:
            DataContractResult if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/{data_contract_id}/results/latest"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting latest data contract result for {data_contract_id}: {err}"
            )
        return None

    def get_data_contract_result_by_id(
        self, data_contract_id: Uuid, result_id: Uuid
    ) -> Optional[DataContractResult]:
        """
        Get a specific data contract execution result by ID

        Args:
            data_contract_id: UUID of the data contract
            result_id: UUID of the specific result

        Returns:
            DataContractResult if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/{data_contract_id}/results/{result_id}"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting data contract result {result_id} for {data_contract_id}: {err}"
            )
        return None

    def delete_data_contract_result(
        self, data_contract_id: Uuid, timestamp: int
    ) -> bool:
        """
        Delete a data contract result at a specific timestamp

        Args:
            data_contract_id: UUID of the data contract
            timestamp: Timestamp of the result to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.delete(
                f"{self.get_suffix(DataContract)}/{data_contract_id}/results/{timestamp}"
            )
            return True
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error deleting data contract result at {timestamp} for {data_contract_id}: {err}"
            )
        return False

    def validate_data_contract(
        self, data_contract_id: Uuid
    ) -> Optional[DataContractResult]:
        """
        Trigger on-demand validation of a data contract

        Args:
            data_contract_id: UUID of the data contract to validate

        Returns:
            DataContractResult if successful, None otherwise
        """
        try:
            resp = self.client.post(
                f"{self.get_suffix(DataContract)}/{data_contract_id}/validate"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error validating data contract {data_contract_id}: {err}")
        return None
