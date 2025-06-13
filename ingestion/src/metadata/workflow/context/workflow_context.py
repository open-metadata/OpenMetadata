"""
Workflow context definition.

This module defines the WorkflowContext, which holds workflow-level metadata such as the service name.
It is registered with the ContextManager for attribute-based access throughout the workflow system.
"""
from typing import Union

from pydantic import Field

from .base import BaseContext, BaseContextFieldsEnum


class WorkflowContextFieldsEnum(BaseContextFieldsEnum):
    """
    Enum defining all available workflow context fields.
    """

    SERVICE_NAME = "serviceName"


class WorkflowContext(BaseContext):
    """
    Context for workflow-level metadata.
    """

    serviceName: Union[str, None] = Field(
        default=None, description="Name of the service on which the workflow operates"
    )
