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
from metadata.generated.schema.entity.datacontract.odcs.odcsDataContract import (
    ODCSDataContract,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str
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
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/results",
                data=result.model_dump_json(),
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error creating data contract result for {model_str(data_contract_id)}: {err}"
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
            # Build query parameters
            query_params = [f"limit={limit}"]
            if start_ts:
                query_params.append(f"startTs={start_ts}")
            if end_ts:
                query_params.append(f"endTs={end_ts}")

            query_string = "&".join(query_params)
            url = f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/results?{query_string}"

            resp = self.client.get(url)
            if resp:
                return [DataContractResult(**result) for result in resp.get("data", [])]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting data contract results for {model_str(data_contract_id)}: {err}"
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
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/results/latest"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting latest data contract result for {model_str(data_contract_id)}: {err}"
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
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/results/{model_str(result_id)}"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting data contract result {model_str(result_id)} for {model_str(data_contract_id)}: {err}"
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
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/results/{timestamp}"
            )
            return True
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error deleting data contract result at {timestamp} for {model_str(data_contract_id)}: {err}"
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
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/validate"
            )
            if resp:
                return DataContractResult(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error validating data contract {model_str(data_contract_id)}: {err}"
            )
        return None

    def export_to_odcs(
        self, data_contract_id: Uuid
    ) -> Optional[ODCSDataContract]:
        """
        Export a data contract to ODCS (Open Data Contract Standard) format

        Args:
            data_contract_id: UUID of the data contract to export

        Returns:
            ODCSDataContract if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/odcs"
            )
            if resp:
                return ODCSDataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error exporting data contract {model_str(data_contract_id)} to ODCS: {err}"
            )
        return None

    def export_to_odcs_by_fqn(
        self, fqn: str
    ) -> Optional[ODCSDataContract]:
        """
        Export a data contract to ODCS format by fully qualified name

        Args:
            fqn: Fully qualified name of the data contract

        Returns:
            ODCSDataContract if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/name/{fqn}/odcs"
            )
            if resp:
                return ODCSDataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error exporting data contract {fqn} to ODCS: {err}"
            )
        return None

    def export_to_odcs_yaml(
        self, data_contract_id: Uuid
    ) -> Optional[str]:
        """
        Export a data contract to ODCS YAML format

        Args:
            data_contract_id: UUID of the data contract to export

        Returns:
            YAML string if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/{model_str(data_contract_id)}/odcs/yaml"
            )
            if resp:
                if hasattr(resp, "text"):
                    return resp.text
                if isinstance(resp, str):
                    return resp
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error exporting data contract {model_str(data_contract_id)} to ODCS YAML: {err}"
            )
        return None

    def export_to_odcs_yaml_by_fqn(
        self, fqn: str
    ) -> Optional[str]:
        """
        Export a data contract to ODCS YAML format by fully qualified name

        Args:
            fqn: Fully qualified name of the data contract

        Returns:
            YAML string if successful, None otherwise
        """
        try:
            resp = self.client.get(
                f"{self.get_suffix(DataContract)}/name/{fqn}/odcs/yaml"
            )
            if resp:
                if hasattr(resp, "text"):
                    return resp.text
                if isinstance(resp, str):
                    return resp
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error exporting data contract {fqn} to ODCS YAML: {err}"
            )
        return None

    def import_from_odcs(
        self,
        odcs: ODCSDataContract,
        entity_id: Uuid,
        entity_type: str,
    ) -> Optional[DataContract]:
        """
        Import a data contract from ODCS format

        Args:
            odcs: ODCSDataContract object to import
            entity_id: UUID of the entity (table/topic) to attach the contract to
            entity_type: Type of the entity (e.g., 'table', 'topic')

        Returns:
            DataContract if successful, None otherwise
        """
        try:
            resp = self.client.post(
                f"{self.get_suffix(DataContract)}/odcs?entityId={model_str(entity_id)}&entityType={entity_type}",
                data=odcs.model_dump_json(by_alias=True, exclude_none=True),
            )
            if resp:
                return DataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error importing ODCS contract for entity {model_str(entity_id)}: {err}"
            )
        return None

    def import_from_odcs_yaml(
        self,
        yaml_content: str,
        entity_id: Uuid,
        entity_type: str,
    ) -> Optional[DataContract]:
        """
        Import a data contract from ODCS YAML format

        Args:
            yaml_content: YAML string containing the ODCS contract
            entity_id: UUID of the entity (table/topic) to attach the contract to
            entity_type: Type of the entity (e.g., 'table', 'topic')

        Returns:
            DataContract if successful, None otherwise
        """
        try:
            resp = self.client.post(
                f"{self.get_suffix(DataContract)}/odcs/yaml?entityId={model_str(entity_id)}&entityType={entity_type}",
                data=yaml_content,
                headers={"Content-Type": "application/x-yaml"},
            )
            if resp:
                return DataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error importing ODCS YAML contract for entity {model_str(entity_id)}: {err}"
            )
        return None

    def create_or_update_from_odcs(
        self,
        odcs: ODCSDataContract,
        entity_id: Uuid,
        entity_type: str,
    ) -> Optional[DataContract]:
        """
        Create or update a data contract from ODCS format (smart merge)

        If a contract already exists for the entity, this will merge the
        imported ODCS fields with the existing contract, preserving fields
        not present in the ODCS format.

        Args:
            odcs: ODCSDataContract object to import
            entity_id: UUID of the entity (table/topic) to attach the contract to
            entity_type: Type of the entity (e.g., 'table', 'topic')

        Returns:
            DataContract if successful, None otherwise
        """
        try:
            resp = self.client.put(
                f"{self.get_suffix(DataContract)}/odcs?entityId={model_str(entity_id)}&entityType={entity_type}",
                data=odcs.model_dump_json(by_alias=True, exclude_none=True),
            )
            if resp:
                return DataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error creating/updating ODCS contract for entity {model_str(entity_id)}: {err}"
            )
        return None

    def create_or_update_from_odcs_yaml(
        self,
        yaml_content: str,
        entity_id: Uuid,
        entity_type: str,
    ) -> Optional[DataContract]:
        """
        Create or update a data contract from ODCS YAML format (smart merge)

        If a contract already exists for the entity, this will merge the
        imported ODCS fields with the existing contract, preserving fields
        not present in the ODCS format.

        Args:
            yaml_content: YAML string containing the ODCS contract
            entity_id: UUID of the entity (table/topic) to attach the contract to
            entity_type: Type of the entity (e.g., 'table', 'topic')

        Returns:
            DataContract if successful, None otherwise
        """
        try:
            resp = self.client.put(
                f"{self.get_suffix(DataContract)}/odcs/yaml?entityId={model_str(entity_id)}&entityType={entity_type}",
                data=yaml_content,
                headers={"Content-Type": "application/x-yaml"},
            )
            if resp:
                return DataContract(**resp)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error creating/updating ODCS YAML contract for entity {model_str(entity_id)}: {err}"
            )
        return None
