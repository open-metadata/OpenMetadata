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
Mixin class containing Search Index specific methods

To be used by OpenMetadata class
"""
import traceback
from typing import Optional

from metadata.generated.schema.entity.data.searchIndex import (
    SearchIndex,
    SearchIndexSampleData,
)
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaSearchIndexMixin:
    """
    OpenMetadata API methods related to search index.

    To be inherited by OpenMetadata
    """

    client: REST

    def ingest_search_index_sample_data(
        self, search_index: SearchIndex, sample_data: SearchIndexSampleData
    ) -> Optional[SearchIndexSampleData]:
        """
        PUT sample data for a search index

        :param search_index: SearchIndex Entity to update
        :param sample_data: Data to add
        """
        resp = None
        try:
            resp = self.client.put(
                f"{self.get_suffix(SearchIndex)}/{search_index.id.root}/sampleData",
                data=sample_data.model_dump_json(),
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PUT sample data for {search_index.fullyQualifiedName.root}: {exc}"
            )

        if resp:
            try:
                return SearchIndexSampleData(**resp["sampleData"])
            except UnicodeError as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Unicode Error parsing the sample data response "
                    f"from {search_index.fullyQualifiedName.root}: {err}"
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Error trying to parse sample data results"
                    f"from {search_index.fullyQualifiedName.root}: {exc}"
                )

        return None
