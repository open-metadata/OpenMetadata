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
Classification run manager for auto-classification workflows.
"""
from collections import defaultdict
from typing import Any, Dict, List, Optional, Protocol

from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ClassificationManagerInterface(Protocol):
    def get_enabled_classifications(
        self, filter_names: Optional[List[str]] = None
    ) -> List[Classification]:
        ...

    def get_enabled_tags(self, classifications: List[Classification]) -> List[Tag]:
        ...


class ClassificationManager:
    """
    Manages which classifications and tags participate in auto-classification.
    Respects classification-level and tag-level configuration.
    """

    def __init__(self, metadata: OpenMetadata[Any, Any]):
        self.metadata: OpenMetadata[Any, Any] = metadata
        self._classification_cache: Dict[str, List[Classification]] = defaultdict(list)
        self._tags_cache: Dict[str, List[Tag]] = {}

    def get_enabled_classifications(
        self, filter_names: Optional[List[str]] = None
    ) -> List[Classification]:
        """
        Fetch classifications that have auto-classification enabled.

        Args:
            filter_names: Optional list of classification names to include.
                         If provided, only these classifications will be considered.

        Returns:
            List of enabled classification configs
        """
        cache_key = ",".join(sorted(filter_names)) if filter_names else "all"

        cached_classifications = self._classification_cache[cache_key]

        if cached_classifications:
            logger.debug(
                f"Returning cached enabled classifications for filter: {cache_key}"
            )
            return cached_classifications

        logger.debug("Fetching enabled classifications from OpenMetadata")

        try:
            classifications = list(
                self.metadata.list_all_entities(
                    entity=Classification,
                    fields=[
                        "name",
                        "autoClassificationConfig",
                        "mutuallyExclusive",
                    ],
                )
            )
        except Exception as exc:
            logger.error(f"Failed to fetch classifications: {exc}")
            return []

        for classification in classifications:
            if filter_names and classification.name.root not in filter_names:
                logger.debug(
                    f"Skipping classification {classification.name.root} (not in filter)"
                )
                continue

            auto_config = classification.autoClassificationConfig
            if not auto_config or not auto_config.enabled:
                logger.debug(
                    f"Skipping classification {classification.name.root} (auto-classification disabled)"
                )
                continue

            cached_classifications.append(classification)

        logger.info(
            f"Found {len(cached_classifications)} enabled classifications: {[c.name.root for c in cached_classifications]}"
        )
        return cached_classifications

    def get_enabled_tags(self, classifications: List[Classification]) -> List[Tag]:
        """
        Get all tags with recognizers from enabled classifications.

        Filters out:
        - Tags where autoClassificationEnabled = False
        - Tags without recognizers

        Args:
            classifications: List of enabled classification configs

        Returns:
            List of tags ready for auto-classification
        """
        classification_names = [c.name.root for c in classifications]

        cache_key = ",".join(sorted(classification_names))
        if cache_key in self._tags_cache:
            logger.debug(f"Returning cached tags for classifications: {cache_key}")
            return self._tags_cache[cache_key]

        logger.info(
            f"Fetching enabled tags from classifications: {classification_names}"
        )

        candidate_tags: List[Tag] = []

        for classification_name in classification_names:
            try:
                tags = list(
                    self.metadata.list_all_entities(
                        entity=Tag,
                        fields=[
                            "name",
                            "fullyQualifiedName",
                            "recognizers",
                            "autoClassificationEnabled",
                            "autoClassificationPriority",
                            "classification",
                        ],
                        params={
                            "parent": classification_name,
                        },
                    )
                )

                for tag in tags:
                    if not tag.autoClassificationEnabled:
                        logger.debug(
                            f"Skipping tag {tag.fullyQualifiedName} (auto-classification disabled)"
                        )
                        continue

                    if not tag.recognizers:
                        logger.debug(
                            f"Skipping tag {tag.fullyQualifiedName} (no recognizers configured)"
                        )
                        continue

                    candidate_tags.append(tag)

            except Exception as exc:
                logger.error(
                    f"Failed to fetch tags for classification {classification_name}: {exc}"
                )
                continue

        logger.info(
            f"Found {len(candidate_tags)} enabled tags with recognizers: "
            + f"{[t.fullyQualifiedName for t in candidate_tags]}"
        )

        self._tags_cache[cache_key] = candidate_tags
        return candidate_tags

    def clear_cache(self) -> None:
        """Clear cached classifications and tags. Useful for testing."""
        logger.debug("Clearing classification and tag caches")
        self._classification_cache.clear()
        self._tags_cache.clear()
