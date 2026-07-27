"""
Application metadata context definition.

Generic, domain-agnostic context that an AppRunner can populate to surface
app-specific structured data on the run's PipelineStatus.metadata (dumped under
the ``appMetadata`` key). Kept intentionally free-form so any application can
attach run metadata without the framework needing to know its shape.
"""

from typing import Any, Union

from pydantic import Field

from metadata.workflow.context.base import BaseContext, BaseContextFieldsEnum


class AppMetadataContextFieldsEnum(BaseContextFieldsEnum):
    """
    Enum defining all available app-metadata context fields.
    """

    DATA = "data"


class AppMetadataContext(BaseContext):
    """
    Context for arbitrary application-provided run metadata.
    """

    data: Union[dict[str, Any], None] = Field(  # noqa: UP007
        default=None,
        description="Arbitrary structured metadata attached by the application runner",
    )
