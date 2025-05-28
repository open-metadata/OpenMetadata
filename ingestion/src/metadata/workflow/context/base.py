"""
Base context class for workflow contexts.

This module defines the BaseContext, which all workflow context types should inherit from.
It uses Pydantic for data validation, serialization, and type safety.
"""
from pydantic import BaseModel


class BaseContext(BaseModel):
    """
    Base class for all workflow contexts. Extend this for specific context types.
    """

    class Config:
        validate_assignment: bool = True
