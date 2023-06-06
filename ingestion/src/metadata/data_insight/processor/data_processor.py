#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Processor class used to compute refined report data
"""

from __future__ import annotations

import abc
from datetime import datetime, timezone
from typing import Iterable, Optional

from metadata.generated.schema.analytics.reportData import ReportData
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class DataProcessor(abc.ABC):
    """_summary_

    Attributes:
        _data_processor_type: used to instantiate the correct class object
        subclasses: dictionnary mapping _data_processor_type to object
    """

    _data_processor_type: Optional[str] = None
    subclasses = {}

    def __init_subclass__(cls, *args, **kwargs) -> None:
        """Hook to map subclass objects to data processor type"""
        super().__init_subclass__(*args, **kwargs)
        cls.subclasses[cls._data_processor_type] = cls

    @classmethod
    def create(cls, _data_processor_type, metadata: OpenMetadata):
        if _data_processor_type not in cls.subclasses:
            raise NotImplementedError
        return cls.subclasses[_data_processor_type](metadata)

    def __init__(self, metadata: OpenMetadata):
        self.metadata = metadata
        self.timestamp = datetime.now(timezone.utc).timestamp() * 1000
        self.processor_status = SourceStatus()

    @abc.abstractmethod
    def fetch_data(self):
        raise NotImplementedError

    @abc.abstractmethod
    def refine(self) -> ReportData:
        raise NotImplementedError

    @abc.abstractmethod
    def process(self) -> Iterable[ReportData]:
        raise NotImplementedError

    @abc.abstractmethod
    def get_status(self) -> SourceStatus:
        raise NotImplementedError
