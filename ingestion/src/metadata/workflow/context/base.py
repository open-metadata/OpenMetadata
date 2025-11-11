"""
Base context class for workflow contexts.

This module defines the BaseContext, which all workflow context types should inherit from.
It uses Pydantic for data validation, serialization, and type safety.
"""
from enum import Enum

from pydantic import BaseModel


class BaseContextFieldsEnum(Enum):
    """
    Base class for all workflow context fields.
    """


class BaseContext(BaseModel):
    """
    Base class for all workflow contexts. Extend this for specific context types.
    """

    class Config:
        validate_assignment: bool = True
