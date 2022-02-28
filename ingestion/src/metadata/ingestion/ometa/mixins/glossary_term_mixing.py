"""
Mixin class containing Glossary Term specific methods

To be used be OpenMetadata
"""
import logging
from typing import Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name
logger = logging.getLogger(__name__)


class GlossaryTermMixin:
    def create_glossary_term(self, entity: Type[T], glossary_term_body):
        """Method to create new Glossary Term
        Args:
            glossary_term_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(entity), data=glossary_term_body.json()
        )
        logger.info(f"Created a Glossary Term: {resp}")
