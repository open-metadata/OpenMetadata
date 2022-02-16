"""
Mixin class containing Glossaries specific methods

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
    def list_glossaries(
        self, entity: Type[T], fields: Optional[List[str]] = None
    ) -> Optional[List[T]]:
        """Get list of Glossary pydantic model

        Args:
            entity: entity class model
            fields (List): list of fields to pass with the request
        """

        fields_str = "?fields=" + ",".join(fields) if fields else ""
        try:
            resp = self.client.get(f"{self.get_suffix(entity)}/{fields_str}")
            return [entity(**glossaries_resp) for glossaries_resp in resp.get("data")]
        except APIError as err:
            logger.error(f"GET {entity.__name__}. Error {err.status_code} - {err}")
            return None

    def create_glossaries_category(self, glossaries_body: Glossary):
        """Method to create new Glossary category
        Args:
            glossaries_body (Glossary): body of the request
        """
        path = "/glossaries"
        resp = self.client.put(path=path, data=glossaries_body.json())
        logger.info(f"Created a Glossary: {resp}")
