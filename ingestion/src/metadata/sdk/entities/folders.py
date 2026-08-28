"""Folders entity SDK with fluent API for Context Center."""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createFolder import CreateFolder
from metadata.generated.schema.entity.data.folder import Folder
from metadata.sdk.entities.base import BaseEntity


class Folders(BaseEntity[Folder, CreateFolder]):
    """Context Center Folders SDK facade.

    Folders organize Context Center files into a hierarchy. The underlying API lives at
    ``/v1/contextCenter/drive/folders``.
    """

    @classmethod
    def entity_type(cls) -> Type[Folder]:  # noqa: UP006
        """Return the Folder entity type."""
        return Folder
