import datetime
import logging
from typing import Any

import great_expectations.exceptions as ge_exceptions
from great_expectations.core.batch import BatchDefinition
from great_expectations.core.util import datetime_to_int, parse_string_to_datetime
from great_expectations.datasource.data_connector.sorter import Sorter

logger = logging.getLogger(__name__)


class DateTimeSorter(Sorter):
    def __init__(self, name: str, orderby: str = "asc", datetime_format="%Y%m%d"):
        super().__init__(name=name, orderby=orderby)

        if datetime_format and not isinstance(datetime_format, str):
            raise ge_exceptions.SorterError(
                f"""DateTime parsing formatter "datetime_format_string" must have string type (actual type is
        "{str(type(datetime_format))}").
                    """
            )

        self._datetime_format = datetime_format

    def get_batch_key(self, batch_definition: BatchDefinition) -> Any:
        batch_identifiers: dict = batch_definition.batch_identifiers
        partition_value: Any = batch_identifiers[self.name]
        dt: datetime.date = parse_string_to_datetime(
            datetime_string=partition_value,
            datetime_format_string=self._datetime_format,
        )
        return datetime_to_int(dt=dt)

    def __repr__(self) -> str:
        doc_fields_dict: dict = {
            "name": self.name,
            "reverse": self.reverse,
            "type": "DateTimeSorter",
            "date_time_format": self._datetime_format,
        }
        return str(doc_fields_dict)
