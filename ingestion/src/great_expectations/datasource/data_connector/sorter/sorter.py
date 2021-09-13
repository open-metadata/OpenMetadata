import logging
from typing import Any, List

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.batch import BatchDefinition

logger = logging.getLogger(__name__)


class Sorter:
    def __init__(self, name: str, orderby: str = "asc"):
        self._name = name
        if orderby is None or orderby == "asc":
            reverse: bool = False
        elif orderby == "desc":
            reverse: bool = True
        else:
            raise ge_exceptions.SorterError(
                f'Illegal sort order "{orderby}" for attribute "{name}".'
            )
        self._reverse = reverse

    def get_sorted_batch_definitions(
        self, batch_definitions: List[BatchDefinition]
    ) -> List[BatchDefinition]:
        return sorted(
            batch_definitions,
            key=self._verify_sorting_directives_and_get_partition_key,
            reverse=self.reverse,
        )

    def _verify_sorting_directives_and_get_partition_key(
        self, batch_definition: BatchDefinition
    ) -> Any:
        batch_identifiers: dict = batch_definition.batch_identifiers
        if batch_identifiers.get(self.name) is None:
            raise ge_exceptions.SorterError(
                f'Unable to sort batch_definition "{batch_definition}" by attribute "{self.name}".'
            )
        return self.get_batch_key(batch_definition=batch_definition)

    def get_batch_key(self, batch_definition: BatchDefinition) -> Any:
        raise NotImplementedError

    @property
    def name(self) -> str:
        return self._name

    @property
    def reverse(self) -> bool:
        return self._reverse

    def __repr__(self) -> str:
        doc_fields_dict: dict = {"name": self.name, "reverse": self.reverse}
        return str(doc_fields_dict)
