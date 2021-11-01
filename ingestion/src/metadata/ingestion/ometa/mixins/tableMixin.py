"""
Mixin class containing Table specific methods

To be used by OpenMetadata class
"""
import logging
from typing import Any, Dict, Generic, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.api.lineage.addLineage import AddLineage
from metadata.ingestion.ometa.client import REST, APIError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class OMetaTableMixin(Generic[T]):
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST
