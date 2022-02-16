"""
Mixin class containing Glossary specific methods

To be used be OpenMetadata
"""
import logging
from typing import List, Optional, Type, TypeVar

from pydantic import BaseModel

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.ingestion.ometa.client import APIError

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name
logger = logging.getLogger(__name__)


class GlossaryMixin:
    def __init__(self):
        pass
