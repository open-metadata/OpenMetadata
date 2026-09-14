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
"""Tag registration shared by Databricks and Unity Catalog sources."""

import traceback
from collections.abc import Iterable
from typing import TYPE_CHECKING, ClassVar, cast

from metadata.generated.schema.entity.services.ingestionPipelines.status import StackTraceError
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification

if TYPE_CHECKING:
    from metadata.ingestion.source.database.database_service import DatabaseServiceSource


class DatabricksTagsMixin:
    """Register valued and key-only tags using connector-specific descriptions."""

    tag_description: ClassVar[str]
    tag_classification_description: ClassVar[str]
    valueless_tag_classification: ClassVar[str]
    valueless_tag_description: ClassVar[str]

    def _register_tag(
        self, entity_fqn: str, tag_name: str | None, tag_value: str | None
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Register and attach a source tag, yielding individual conversion failures."""
        if not tag_name:
            return
        try:
            source = cast("DatabaseServiceSource", cast("object", self))
            has_value = bool(tag_value and str(tag_value).strip())
            definition = source.define_tag(
                classification_name=tag_name if has_value else self.valueless_tag_classification,
                tag_name=cast("str", tag_value) if has_value else tag_name,
                classification_description=(
                    self.tag_classification_description if has_value else self.valueless_tag_description
                ),
                tag_description=self.tag_description if has_value else self.valueless_tag_description,
            )
            if definition:
                source.attach_tag(entity_fqn=entity_fqn, tag=definition)
        except Exception as exc:
            yield Either(
                right=None,
                left=StackTraceError(
                    name="Tags and Classifications",
                    error=f"Failed to register tag [{tag_name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                ),
            )
