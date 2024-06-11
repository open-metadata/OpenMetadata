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
Mixin class containing OpenLineageEvent specific methods

To be used by OpenMetadata class
"""
from typing import List

from metadata.generated.schema.lineage.openLineageWrappedEvent import (
    OpenLineageWrappedEvent,
)
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.source.pipeline.openlineage.models import EventType
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

PUBLIC_LINEAGE_ENDPOINT = "/openlineage/lineage"
INTERNAL_EVENTS_ENDPOINT = "/openlineage/internal/events"


class OMetaOpenLineageEventMixin:
    """
    OpenMetadata API methods related to OpenLineageEvents.

    To be inherited by OpenMetadata
    """

    client: REST

    def store_raw_openlineage_event(self, raw_lineage_event: str) -> None:
        """
        Store a raw lineage event.

        :param raw_lineage_event: The raw lineage event in string format.
        """
        try:
            self.client.post(
                PUBLIC_LINEAGE_ENDPOINT,
                data=raw_lineage_event,
            )
            logger.debug(f"Stored raw OpenLineage event: {raw_lineage_event}")
        except Exception as e:
            logger.error("Failed to store raw OpenLineage event", exc_info=True)

    def get_openlineage_events_for_type(
        self, event_type: str
    ) -> List[OpenLineageWrappedEvent]:
        """
        Get lineage events of a specific type.

        :param event_type: The type of lineage events to retrieve.
        :return: A list of OpenLineageWrappedEvent.
        """
        try:
            response = self.client.get(
                INTERNAL_EVENTS_ENDPOINT, params={"eventType": event_type}
            )
            logger.debug(f"Retrieved lineage events for type: {event_type}")
            return [
                OpenLineageWrappedEvent(**data) for data in response.get("data", [])
            ]
        except Exception as e:
            logger.error(
                f"Failed to retrieve lineage events for type {event_type}",
                exc_info=True,
            )
            return []

    def get_openlineage_events_for_runid(
        self, run_id: str
    ) -> List[OpenLineageWrappedEvent]:
        """
        Get lineage events for a specific run ID.

        :param run_id: The run ID to retrieve lineage events for.
        :return: A list of OpenLineageWrappedEvent.
        """
        try:
            response = self.client.get(INTERNAL_EVENTS_ENDPOINT, data={"runId": run_id})
            logger.debug(f"Retrieved lineage events for runID: {run_id}")
            return [
                OpenLineageWrappedEvent(**data) for data in response.get("data", [])
            ]
        except Exception as e:
            logger.error(
                f"Failed to retrieve lineage events for runID {run_id}", exc_info=True
            )
            return []

    def delete_openlineage_event(self, event: OpenLineageWrappedEvent) -> None:
        """
        Delete a lineage event.

        :param event: The lineage event to delete.
        """
        try:
            event_id = str(event.id.__root__)
            self.client.delete(INTERNAL_EVENTS_ENDPOINT + f"/{event_id}")
            logger.debug(f"Deleted OpenLineage event with ID: {event_id}")
        except Exception as e:
            logger.error("Failed to delete OpenLineage event", exc_info=True)

    def mark_event_as_processed(self, event: OpenLineageWrappedEvent) -> None:
        """
        Mark events as processed by updating their processed_at timestamp.

        :param event_id:  event IDs to mark as processed.
        """
        try:
            self.client.put(
                INTERNAL_EVENTS_ENDPOINT + f"/{str(event.id.__root__)}/processed"
            )
            logger.debug(f"Marked event as processed: {event}")
        except Exception as e:
            logger.error("Failed to mark event as processed", exc_info=True)

    def get_unprocessed_complete_events(self) -> List[OpenLineageWrappedEvent]:
        """
        Get unprocessed event of type COMPLETE.

        :return: List of unprocessed run IDs.
        """
        try:
            response = self.client.get(
                INTERNAL_EVENTS_ENDPOINT,
                data={"unprocessed": False, "eventType": EventType.COMPLETE.value},
            )
            events = [
                OpenLineageWrappedEvent(**data) for data in response.get("data", [])
            ]
            logger.debug(f"Retrieved unprocessed events: {events}")
            return events
        except Exception as e:
            logger.warning("Failed to retrieve unprocessed events", exc_info=True)
            return []
