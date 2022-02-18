"""
Mixin class containing Glossaries specific methods

To be used be OpenMetadata
"""
import logging
from typing import Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name
logger = logging.getLogger(__name__)


class GlossaryMixin:
    def create_glossaries_category(self, entity: Type[T], glossaries_body):
        """Method to create new Glossary category
        Args:
            glossaries_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(entity), data=glossaries_body.json()
        )
        logger.info(f"Created a Glossary: {resp}")
