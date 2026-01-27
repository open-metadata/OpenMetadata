from typing import List, Optional, Tuple

from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag


class FakeClassificationManager:
    def __init__(self, *backend: Tuple[Classification, List[Tag]]):
        self.classifications = [c for c, _ in backend]
        self.tags = {c.name.root: tags for c, tags in backend}

    def get_enabled_classifications(
        self, filter_names: Optional[List[str]] = None
    ) -> List[Classification]:
        return self.classifications

    def get_enabled_tags(self, classifications: List[Classification]) -> List[Tag]:
        tags = []
        for classification in classifications:
            tags.extend(self.tags.get(classification.name.root, []))
        return tags

    def extend(self, *backend: Tuple[Classification, List[Tag]]):
        for classification, tags in backend:
            if classification not in self.classifications:
                self.classifications.append(classification)

            if classification.name.root not in self.tags:
                self.tags[classification.name.root] = []

            self.tags[classification.name.root].extend(tags)
        return self
