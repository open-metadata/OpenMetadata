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
Mixin class containing File specific methods

To be used by OpenMetadata class
"""
import traceback
from typing import Optional

from metadata.generated.schema.entity.data.file import File
from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaFileMixin:
    """
    OpenMetadata API methods related to Files.

    To be inherited by OpenMetadata
    """

    client: REST

    def ingest_file_sample_data(
        self, file: File, sample_data: TableData
    ) -> Optional[File]:
        """
        PUT sample data for a file

        :param file: File Entity to update
        :param sample_data: Data to add
        """
        resp = None
        try:
            try:
                data = sample_data.model_dump_json()
            except Exception:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error serializing sample data for {file.fullyQualifiedName.root}"
                    " please check if the data is valid"
                )
                return None

            resp = self.client.put(
                f"{self.get_suffix(File)}/{file.id.root}/sampleData",
                data=data,
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {file.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return File(**resp)
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {file.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {file.fullyQualifiedName.root}: {exc}"
                )

        return None

    def get_file_sample_data(self, file: File) -> Optional[File]:
        """
        GET call for the /sampleData endpoint for a given File

        Returns a File entity with TableData (sampleData informed)
        """
        resp = None
        try:
            resp = self.client.get(
                f"{self.get_suffix(File)}/{file.id.root}/sampleData",
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to GET sample data for {file.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return File(**resp)
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unicode Error parsing the sample data response from {file.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error trying to parse sample data results from {file.fullyQualifiedName.root}: {exc}"
                )

        return None
