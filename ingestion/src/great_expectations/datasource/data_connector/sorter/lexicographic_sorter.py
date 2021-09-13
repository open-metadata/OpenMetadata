import logging
from typing import Any

from great_expectations.core.batch import BatchDefinition
from great_expectations.datasource.data_connector.sorter import Sorter

logger = logging.getLogger(__name__)


class LexicographicSorter(Sorter):
    def get_batch_key(self, batch_definition: BatchDefinition) -> Any:
        batch_identifiers: dict = batch_definition.batch_identifiers
        batch_value: Any = batch_identifiers[self.name]
        return batch_value

    def __repr__(self) -> str:
        doc_fields_dict: dict = {
            "name": self.name,
            "reverse": self.reverse,
            "type": "LexicographicSorter",
        }
        return str(doc_fields_dict)
