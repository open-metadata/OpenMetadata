"""
Context manager for workflow contexts.

This module provides the ContextManager singleton, which dynamically registers and exposes
workflow contexts as attributes. Contexts are registered using the register_context decorator.
This approach combines extensibility with attribute-based access and IDE/static analysis support.
"""

import threading
from enum import Enum
from typing import Any, Optional

from metadata.workflow.context.base import BaseContext, BaseContextFieldsEnum
from metadata.workflow.context.workflow_context import WorkflowContext

# NOTE: To make the context available on the context manager we need to:
#         1. Add it to the ContextsEnum
#         2. Declare it and initialize it as a class attribute in ContextManager


class ContextsEnum(Enum):
    """
    Enum defining all available workflow contexts.
    Each member represents a context type that can be registered with the ContextManager.
    """

    WORKFLOW = "workflow"


class ContextManager:
    """
    Singleton manager for all workflow contexts. Dynamically registers and exposes contexts as attributes.
    """

    _instance: Optional["ContextManager"] = None
    _lock: threading.RLock = threading.RLock()

    # List of Contexts
    workflow: WorkflowContext = WorkflowContext()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls):
        """
        Return the singleton instance of ContextManager, creating it if necessary.
        """
        if cls._instance is None:
            _ = cls()
        return cls._instance

    @classmethod
    def set_context_attr(
        cls, context_enum: ContextsEnum, field_enum: BaseContextFieldsEnum, value: Any
    ):
        """
        Thread-safe method to set an attribute on a context.

        Args:
            context_enum (Enum): Enum member representing the context (e.g., ContextManager.Contexts.workflow).
            field_enum (Enum): Enum member representing the field (e.g., WorkflowContext.Fields.serviceName).
            value (Any): The value to set for the field.
        """
        with cls._lock:
            instance = cls.get_instance()
            context = getattr(instance, context_enum.value)
            setattr(context, field_enum.value, value)

    @classmethod
    def get_context_attr(
        cls, context_enum: ContextsEnum, field_enum: BaseContextFieldsEnum
    ) -> Any:
        """
        Thread-safe method to get an attribute from a context.

        Args:
            context_enum (Enum): Enum member representing the context (e.g., ContextManager.Contexts.workflow).
            field_enum (Enum): Enum member representing the field (e.g., WorkflowContext.Fields.serviceName).

        Returns:
            Any: The value of the requested field.
        """
        with cls._lock:
            instance = cls.get_instance()
            context = getattr(instance, context_enum.value)
            return getattr(context, field_enum.value)

    @classmethod
    def get_context(cls, context_enum: ContextsEnum) -> BaseContext:
        """
        Thread-safe method to retrieve the full context object by Enum member.

        Args:
            context_enum (Enum): Enum member representing the context (e.g., ContextManager.Contexts.workflow).

        Returns:
            Any: The context object instance.
        """
        with cls._lock:
            instance = cls.get_instance()
            return getattr(instance, context_enum.value)

    @classmethod
    def dump_contexts(cls) -> Optional[dict[str, Any]]:
        """
        Dump all available contexts as a dictionary: {contextName: content}
        Assumes each context is a Pydantic object.
        """
        with cls._lock:
            instance = cls.get_instance()
            result: dict[str, Any] = {}
            for context_enum in ContextsEnum:
                context_obj = getattr(instance, context_enum.value)
                context_dict = context_obj.model_dump(exclude_none=True)
                if context_dict:
                    result[context_enum.value] = context_dict
            if result:
                return result
            return None
