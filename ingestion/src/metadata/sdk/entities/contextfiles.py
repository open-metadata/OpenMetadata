"""ContextFiles entity SDK with fluent API for Context Center."""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createContextFile import CreateContextFile
from metadata.generated.schema.entity.data.contextFile import ContextFile
from metadata.sdk.entities.base import BaseEntity


class ContextFiles(BaseEntity[ContextFile, CreateContextFile]):
    """Context Center Files SDK facade.

    A ``ContextFile`` is a user-uploaded document tracked inside OpenMetadata's Context Center.
    The underlying API lives at ``/v1/contextCenter/drive/files``. Multipart upload, binary
    download, and the dedicated ``/move`` endpoint are not exposed here — callers needing those
    should hit the HTTP API directly.
    """

    @classmethod
    def entity_type(cls) -> Type[ContextFile]:  # noqa: UP006
        """Return the ContextFile entity type."""
        return ContextFile
