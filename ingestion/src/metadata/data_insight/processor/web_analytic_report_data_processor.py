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

from collections import namedtuple
from typing import Generator, Iterable, Optional

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.webAnalyticEntityViewReportData import (
    WebAnalyticEntityViewReportData,
)
from metadata.generated.schema.analytics.reportDataType.webAnalyticUserActivityReportData import (
    WebAnalyticUserActivityReportData,
)
from metadata.generated.schema.analytics.webAnalyticEventData import (
    WebAnalyticEventData,
)
from metadata.generated.schema.entity.data import (
    chart,
    dashboard,
    database,
    databaseSchema,
    mlmodel,
    pipeline,
    table,
    topic,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.api.source import SourceStatus
from metadata.utils.helpers import get_entity_tier_from_tags
from metadata.utils.logger import data_insight_logger
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)

logger = data_insight_logger()

LIMIT = 1000
ENTITIES = {
    "chart": chart.Chart,
    "dashboard": dashboard.Dashboard,
    "database": database.Database,
    "databaseSchema": databaseSchema.DatabaseSchema,
    "mlmodel": mlmodel.MlModel,
    "pipeline": pipeline.Pipeline,
    "table": table.Table,
    "topic": topic.Topic,
}

CACHED_EVENTS = []
START_TS = str(get_beginning_of_day_timestamp_mill(days=1))
END_TS = str(get_end_of_day_timestamp_mill(days=1))


class WebAnalyticEntityViewReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "WebAnalyticEntityViewReportData"

    def fetch_data(self) -> Iterable[WebAnalyticEventData]:
        if CACHED_EVENTS:
            for event in CACHED_EVENTS:
                yield event
        else:
            CACHED_EVENTS.extend(
                self.metadata.list_entities(
                    entity=WebAnalyticEventData,
                    params={
                        "startTs": START_TS,
                        "endTs": END_TS,
                        "eventType": "PageView",
                    },
                ).entities
            )
            for event in CACHED_EVENTS:
                yield event

    def _refine_entity_event(self) -> Generator[dict, WebAnalyticEventData, None]:
        """Coroutine to process entity web analytic event

        Yields:
            Generator[dict, WebAnalyticEventData, None]: _description_
        """
        refined_data = {}
        EntityObj = namedtuple("EntityObj", ["entity_type", "fqn"])

        while True:
            event = yield refined_data
            split_url = [url for url in event.eventData.url.split("/") if url]  # type: ignore

            if not split_url or split_url[0] not in ENTITIES:
                continue

            entity_obj = EntityObj(split_url[0], split_url[1])

            if entity_obj.fqn not in refined_data:
                entity = self.metadata.get_by_name(
                    ENTITIES[entity_obj.entity_type],
                    fqn=entity_obj.fqn,
                    fields="*",
                )

                try:
                    tags = (
                        [tag.tagFQN.__root__ for tag in entity.tags]
                        if entity.tags
                        else None
                    )
                    entity_tier = get_entity_tier_from_tags(entity.tags)
                except AttributeError as exc:
                    entity_tier = None
                    tags = None
                    logger.warning(
                        f"Attribute not supported for entity type {entity.__class__.__name__} -- {exc}"
                    )

                try:
                    owner = entity.owner.name if entity.owner else None
                    owner_id = str(entity.owner.id.__root__) if entity.owner else None
                except AttributeError as exc:
                    owner = None
                    owner_id = None
                    logger.warning(
                        f"Attribute not supported for entity type {entity.__class__.__name__} -- {exc}"
                    )
                    self.processor_status.warning(
                        entity.__class__.__name__,
                        "`tags` attribute not supported for entity type",
                    )

                refined_data[split_url[1]] = {
                    "entityType": entity_obj.entity_type.title(),
                    "entityTier": entity_tier,
                    "entityFqn": entity_obj.fqn,
                    "tagsFQN": tags,
                    "owner": owner,
                    "ownerId": owner_id,
                    "views": 1,
                }

            else:
                refined_data[split_url[1]]["views"] += 1

    def refine(self):
        """Aggregates data. It will return a dictionary of the following shape

        {
            "user_id": {
                "<session_id>": [
                    {<event_data>},
                    {<event_data>},
                ],
                "<session_id>": [
                    {<event_data>},
                    {<event_data>},
                ]
            },
            ...
        }
        """
        entity_refined_data = {}
        refine_entity_event = self._refine_entity_event()
        next(refine_entity_event)  # pylint: disable=stop-iteration-return

        for event in self.fetch_data():
            entity_refined_data = refine_entity_event.send(event)

        for entity_data in entity_refined_data:
            yield ReportData(
                timestamp=self.timestamp,
                reportDataType=ReportDataType.WebAnalyticEntityViewReportData.value,
                data=WebAnalyticEntityViewReportData.parse_obj(
                    entity_refined_data[entity_data]
                ),
            )  # type: ignore

    def process(self) -> Iterable[ReportData]:
        yield from self.refine()

    def get_status(self) -> SourceStatus:
        return self.processor_status


class WebAnalyticUserActivityReportDataProcessor(DataProcessor):
    """Data processor for user scoped web analytic events"""

    _data_processor_type = "WebAnalyticUserActivityReportData"

    @staticmethod
    def _compute_session_metrics(sessions: dict[str, list]):
        """Compute the total session duration in seconds"""
        total_sessions = len(sessions)
        total_session_duration_seconds = 0
        for _, value in sessions.items():
            total_session_duration_seconds += (max(value) - min(value)) / 1000

        return {
            "totalSessions": total_sessions,
            "totalSessionDuration": total_session_duration_seconds,
        }

    def _get_user_details(self, user_id: str) -> dict:
        """Get user details from user id

        Returns:
            dict: _description_
        """

        user_entity: Optional[User] = self.metadata.get_by_id(
            User,
            user_id,
            fields=["*"],
        )

        if not user_entity:
            return {}

        teams = user_entity.teams
        return {
            "user_name": user_entity.name.__root__,
            "team": teams.__root__[0].name if teams else None,
        }

    def _refine_user_event(self) -> Generator[dict, WebAnalyticEventData, None]:
        """Corountine to process user event from web analytic event

        Yields:
            Generator[dict, WebAnalyticEventData, None]: _description_
        """
        user_details = {}
        refined_data = {}

        while True:
            event = yield refined_data

            user_id = str(event.eventData.userId.__root__)  # type: ignore
            session_id = str(event.eventData.sessionId.__root__)  # type: ignore
            timestamp = event.timestamp.__root__  # type: ignore

            if not user_details.get(user_id):
                user_details_data = self._get_user_details(user_id)
                user_details[user_id] = user_details_data

            if not refined_data.get(user_id):
                refined_data[user_id] = {
                    "userName": user_details[user_id].get("user_name"),
                    "userId": user_id,
                    "team": user_details[user_id].get("team"),
                    "sessions": {
                        session_id: [timestamp],
                    },
                    "totalPageView": 1,
                    "totalSessions": 1,
                    "lastSession": timestamp,
                }

            else:
                user_data = refined_data[user_id]
                if user_data["sessions"].get(session_id):
                    user_data["sessions"][session_id].append(timestamp)
                else:
                    user_data["sessions"][session_id] = [timestamp]
                    user_data["totalSessions"] += 1

                user_data["totalPageView"] += 1

                if timestamp > user_data["lastSession"]:
                    user_data["lastSession"] = timestamp

    def fetch_data(self) -> Iterable[WebAnalyticEventData]:
        if CACHED_EVENTS:
            for event in CACHED_EVENTS:
                yield event
        else:
            CACHED_EVENTS.extend(
                self.metadata.list_entities(
                    entity=WebAnalyticEventData,
                    params={
                        "startTs": START_TS,
                        "endTs": END_TS,
                        "eventType": "PageView",
                    },
                ).entities
            )
            for event in CACHED_EVENTS:
                yield event

    def refine(self) -> Iterable[ReportData]:
        user_refined_data = {}
        refine_user_event = self._refine_user_event()
        next(refine_user_event)  # pylint: disable=stop-iteration-return

        for event in self.fetch_data():
            user_refined_data = refine_user_event.send(event)

        for user_id, _ in user_refined_data.items():
            session_metrics = self._compute_session_metrics(
                user_refined_data[user_id].pop("sessions")
            )
            user_refined_data[user_id] = {
                **user_refined_data[user_id],
                **session_metrics,
            }
            yield ReportData(
                timestamp=self.timestamp,
                reportDataType=ReportDataType.WebAnalyticUserActivityReportData.value,
                data=WebAnalyticUserActivityReportData.parse_obj(
                    user_refined_data[user_id]
                ),
            )  # type: ignore

    def process(self) -> Iterable:
        yield from self.refine()

    def get_status(self) -> SourceStatus:
        return self.processor_status
