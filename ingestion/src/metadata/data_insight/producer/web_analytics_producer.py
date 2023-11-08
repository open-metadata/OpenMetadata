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
Producer class for data insight web analytics reports
"""


from typing import Dict, Optional

from metadata.data_insight.producer.producer_interface import ProducerInterface
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.ingestion.ometa.models import EntityList
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

# We'll get web analytics data for the previous day
START_TS = str(get_beginning_of_day_timestamp_mill(days=1))
END_TS = str(get_end_of_day_timestamp_mill(days=1))

# we'll cache events to avoid fetching them multiple times
# the key will be the entity pagination after value
CACHED_EVENTS: Dict[str, EntityList[WebAnalyticEventData]] = {}


class WebAnalyticsProducer(ProducerInterface):
    """web analytics producer class"""

    entity_type = WebAnalyticEventData
    params = {
        "startTs": START_TS,
        "endTs": END_TS,
        "eventType": "PageView",
    }
    clear_cache = False

    @staticmethod
    def _cache_events(
        key: Optional[str], value: EntityList[WebAnalyticEventData]
    ) -> None:
        """cache events"""
        CACHED_EVENTS[str(key)] = value

    # pylint: disable=dangerous-default-value
    def _get_events(
        self, after: Optional[str], limit=100, fields=["*"]
    ) -> EntityList[WebAnalyticEventData]:
        """Try to retrieve events from catch otherwise retrieve them from DB"""
        events = CACHED_EVENTS.get(str(after))
        if not events:
            events: EntityList[WebAnalyticEventData] = self.metadata.list_entities(
                entity=self.entity_type,
                params=self.params,
                after=after,
                limit=limit,
                fields=fields,
            )  # type: ignore
            self._cache_events(after, events)
        return events

    def _clear_cache(self):
        """clear cache"""
        CACHED_EVENTS.clear()

    def fetch_data(
        self, limit=100, fields=["*"]
    ):  # pylint: disable=dangerous-default-value
        """fetch data for web analytics event"""
        events = self._get_events(None, limit, fields)

        for entity in events.entities:
            yield entity
