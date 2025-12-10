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
Conflict resolution for auto-classification tags.
"""
from collections import defaultdict
from typing import Dict, List

from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.pii.models import ScoredTag
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ConflictResolver:
    """
    Resolves conflicts when multiple tags from the same classification match.
    Implements strategies: highest_confidence, highest_priority, most_specific.
    """

    def resolve_conflicts(
        self,
        scored_tags: List[ScoredTag],
        enabled_classifications: List[Classification],
    ) -> List[ScoredTag]:
        """
        Apply conflict resolution per classification.

        For mutually exclusive classifications: return only 1 tag
        For non-mutually exclusive: return all tags that meet threshold

        Args:
            scored_tags: List of (ScoredTag, score) tuples
            enabled_classifications: List of enabled classification

        Returns:
            List of resolved ScoredTag objects
        """
        if not scored_tags:
            return []

        by_classification: Dict[str, List[ScoredTag]] = defaultdict(list)
        for scored_tag in scored_tags:
            by_classification[scored_tag.classification_name].append(scored_tag)

        resolved: List[ScoredTag] = []

        for classification in enabled_classifications:
            config = classification.autoClassificationConfig
            if not config:
                continue

            classification_name = classification.name.root
            tags_in_classification = by_classification.get(classification_name, [])

            if not tags_in_classification:
                continue

            minimum_confidence = config.minimumConfidence or 0.0
            tags_above_threshold = [
                tag for tag in tags_in_classification if tag.score >= minimum_confidence
            ]

            if not tags_above_threshold:
                logger.debug(
                    f"No tags in classification {classification_name} met minimum confidence {minimum_confidence}"
                )
                continue

            logger.debug(
                f"Classification {classification_name}: {len(tags_above_threshold)} tags above threshold"
            )

            if classification.mutuallyExclusive:
                conflict_resolution = (
                    config.conflictResolution or ConflictResolution.highest_confidence
                )
                winner = self._select_winner(
                    tags_above_threshold, strategy=conflict_resolution
                )
                logger.info(
                    f"Classification {classification_name} (mutually exclusive): "
                    + f"Selected {winner.tag.fullyQualifiedName} with score {winner.score:.3f}"
                )
                resolved.append(winner)
            else:
                logger.info(
                    f"Classification {classification_name} (non-mutually exclusive): "
                    + f"Accepted {len(tags_above_threshold)} tags"
                )
                resolved.extend(tags_above_threshold)

        return resolved

    def _select_winner(
        self, tags: List[ScoredTag], strategy: ConflictResolution
    ) -> ScoredTag:
        """
        Select winning tag based on strategy.

        Args:
            tags: List of ScoredTag objects to choose from
            strategy: Conflict resolution strategy

        Returns:
            Winning ScoredTag
        """
        if not tags:
            raise ValueError("Cannot select winner from empty list")

        if len(tags) == 1:
            return tags[0]

        if strategy == ConflictResolution.highest_confidence:
            winner = max(tags, key=lambda t: (t.score, t.priority))
            logger.debug(
                f"Strategy: highest_confidence -> {winner.tag.fullyQualifiedName} (score={winner.score:.3f})"
            )
            return winner

        elif strategy == ConflictResolution.highest_priority:
            winner = max(tags, key=lambda t: (t.priority, t.score))
            logger.debug(
                f"Strategy: highest_priority -> {winner.tag.fullyQualifiedName} (priority={winner.priority}, score={winner.score:.3f})"
            )
            return winner

        elif strategy == ConflictResolution.most_specific:

            def get_depth(tag: ScoredTag) -> tuple[int, float]:
                fqn = tag.tag.fullyQualifiedName
                if fqn:
                    return (fqn.count("."), tag.score)
                return (0, tag.score)

            winner = max(tags, key=get_depth)
            winner_fqn_str = winner.tag.fullyQualifiedName or "Unknown"
            depth = winner_fqn_str.count(".")
            logger.debug(
                f"Strategy: most_specific -> {winner_fqn_str} (depth={depth}, score={winner.score:.3f})"
            )
            return winner

        else:
            logger.warning(  # pyright: ignore[reportUnreachable]
                f"Unknown conflict resolution strategy: {strategy}, defaulting to highest_confidence"
            )
            return max(tags, key=lambda t: t.score)
