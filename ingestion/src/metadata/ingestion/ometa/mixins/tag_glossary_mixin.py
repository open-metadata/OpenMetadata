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
"""Tag and Glossary Term specific operations"""
import traceback
from typing import Dict

from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaTagGlossaryMixin:
    """Mixin class containing Tag and Glossary Term specific methods"""

    client: REST

    def get_tag_assets(self, fqn: str, limit: int = 10, offset: int = 0) -> Dict:
        """
        Get paginated list of assets for a tag

        Args:
            fqn: Fully qualified name of the tag
            limit: Maximum number of assets to return (default 10, max 1000)
            offset: Offset from which to start returning results (default 0)

        Returns:
            API response as a dictionary containing paginated assets
        """
        try:
            path = f"/tags/name/{fqn}/assets"
            params = {"limit": limit, "offset": offset}
            return self.client.get(path, params)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get tag assets due to {exc}")
            return {}

    def get_glossary_term_assets(
        self, fqn: str, limit: int = 10, offset: int = 0
    ) -> Dict:
        """
        Get paginated list of assets for a glossary term

        Args:
            fqn: Fully qualified name of the glossary term
            limit: Maximum number of assets to return (default 10, max 1000)
            offset: Offset from which to start returning results (default 0)

        Returns:
            API response as a dictionary containing paginated assets
        """
        try:
            path = f"/glossaryTerms/name/{fqn}/assets"
            params = {"limit": limit, "offset": offset}
            return self.client.get(path, params)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not get glossary term assets due to {exc}")
            return {}
