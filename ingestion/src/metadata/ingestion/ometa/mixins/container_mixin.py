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
Mixin class containing Container specific methods

To be used by OpenMetadata class
"""
import base64
import traceback
from typing import Optional

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaContainerMixin:
    """
    OpenMetadata API methods related to Containers.

    To be inherited by OpenMetadata
    """

    client: REST

    def _encode_binary_value(self, value: bytes) -> str:
        """Encode binary value to base64 or binary string representation"""
        try:
            return f"[base64]{base64.b64encode(value).decode('ascii', errors='ignore')}"
        except Exception:
            return f"[binary]{value}"

    def _process_sample_data_row(self, row: list) -> None:
        """Process a single row of sample data, encoding binary values in-place"""
        if not row:
            return

        for col_idx, value in enumerate(row):
            if isinstance(value, bytes):
                row[col_idx] = self._encode_binary_value(value)

    def _process_sample_data_rows(self, sample_data: TableData) -> None:
        """Process all rows in sample data, encoding binary values in-place"""
        if not sample_data or not sample_data.rows:
            return

        for row in sample_data.rows:
            self._process_sample_data_row(row)

    def _serialize_sample_data(
        self, sample_data: TableData, container_fqn: str
    ) -> Optional[str]:
        """Serialize sample data to JSON, returning None on error"""
        try:
            return sample_data.model_dump_json()
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error serializing sample data for {container_fqn}"
                " please check if the data is valid"
            )
            return None

    def _parse_response(self, resp: dict, container_fqn: str) -> Optional[TableData]:
        """Parse response into TableData, returning None on error"""
        try:
            return TableData(**resp["sampleData"])
        except UnicodeError as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Cannot parse response from {container_fqn} due to {err}")
            return None

    def ingest_container_sample_data(
        self, container: Container, sample_data: TableData
    ) -> Optional[TableData]:
        """
        PUT sample data for a container

        :param container: Container Entity to update
        :param sample_data: Data to add
        """
        try:
            self._process_sample_data_rows(sample_data)

            data = self._serialize_sample_data(
                sample_data, container.fullyQualifiedName.root
            )
            if data is None:
                return None

            resp = self.client.put(
                f"{self.get_suffix(Container)}/{container.id.root}/sampleData",
                data=data,
            )

            if resp:
                return self._parse_response(resp, container.fullyQualifiedName.root)

            return None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {container.fullyQualifiedName.root}: {exc}"
            )
            return None

    def get_container_sample_data(self, container: Container) -> Optional[Container]:
        """
        GET call for the /sampleData endpoint for a given Container

        Returns a Container entity with TableData (sampleData informed)
        """
        resp = None
        try:
            resp = self.client.get(
                f"{self.get_suffix(Container)}/{container.id.root}/sampleData",
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to GET sample data for {container.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return Container(**resp)
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {container.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {container.fullyQualifiedName.root}: {exc}"
                )

        return None
