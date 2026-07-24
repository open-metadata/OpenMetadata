"""Pages entity SDK with fluent API for Context Center (articles and quick links)."""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.data.createPage import CreatePage
from metadata.generated.schema.entity.data.page import Page
from metadata.sdk.entities.base import BaseEntity


class Pages(BaseEntity[Page, CreatePage]):
    """Context Center Pages SDK facade.

    A ``Page`` is an article or quick link in the Context Center. The ``pageType`` discriminator
    on the create request selects between ``Article`` and ``QuickLink``. The underlying API lives
    at ``/v1/contextCenter/pages``. Page-specific operations (vote, follow, hierarchy traversal)
    are not exposed here yet — see the Java SDK for that surface.
    """

    @classmethod
    def entity_type(cls) -> Type[Page]:  # noqa: UP006
        """Return the Page entity type."""
        return Page
