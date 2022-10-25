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

import ast
from collections import Counter, defaultdict
from functools import singledispatchmethod
from typing import Iterable, Optional, TypeVar, Union, cast

from metadata.data_insight.processor.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.entityReportData import (
    EntityReportData,
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()

ENTITIES = [
    chart.Chart,
    dashboard.Dashboard,
    database.Database,
    databaseSchema.DatabaseSchema,
    mlmodel.MlModel,
    pipeline.Pipeline,
    table.Table,
    topic.Topic,
]

T = TypeVar("T", *ENTITIES)  # type: ignore


class EntityReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = "EntityReportData"

    def _get_team(self, owner: EntityReference) -> Optional[str]:
        """Get the team from an entity. We'll use this info as well to
        add info if an entity has an owner

        Args:
            owner (EntityReference): owner entity reference from the entity

        Returns:
            Optional[str]
        """
        if not owner:
            return None

        if owner.type == "team":
            return owner.name

        owner_fqn = owner.fullyQualifiedName
        owner_fqn = cast(str, owner.fullyQualifiedName)  # To satisfy type checker

        entity_reference: Optional[User] = self.metadata.get_by_name(
            User,
            owner_fqn,
            fields=["*"],
        )

        if not entity_reference:
            return None

        teams = entity_reference.teams

        if teams:
            return teams.__root__[0].name  # We'll return the first team listed

        return None

    def _get_entity_tier(self, tags: list[TagLabel]) -> Optional[str]:
        """_summary_

        Args:
            tags (list[TagLabel]): list of tags

        Returns:
            Optional[str]
        """
        return next(
            (
                tag.tagFQN.__root__
                for tag in tags
                if tag.tagFQN.__root__.lower().startswith("tier")
            ),
            None,
        )

    @singledispatchmethod
    def _check_entity_description(self, entity: T):
        """dispatch function

        Args:
            entity (T): entity

        Raises:
            TypeError: if single dispatch not implemented for the class
        """
        raise TypeError(
            f"Could not get description for {entity.__class__.__name__}."
            f"Type {type(entity.__class__.__name__)} not supported."
        )

    @_check_entity_description.register(dashboard.Dashboard)
    @_check_entity_description.register(chart.Chart)
    @_check_entity_description.register(database.Database)
    @_check_entity_description.register(databaseSchema.DatabaseSchema)
    @_check_entity_description.register(mlmodel.MlModel)
    @_check_entity_description.register(pipeline.Pipeline)
    @_check_entity_description.register(topic.Topic)
    def _(
        self,
        entity: Union[
            dashboard.Dashboard,
            chart.Chart,
            database.Database,
            databaseSchema.DatabaseSchema,
            mlmodel.MlModel,
            pipeline.Pipeline,
            topic.Topic,
        ],
    ) -> bool:
        """Get description for dashboard entity

        Args:
            entity (dashboard.Dashboard): entity

        Returns:
            bool:
        """
        if entity.description:
            return True
        return False

    @_check_entity_description.register(table.Table)
    def _(self, entity: table.Table) -> bool:
        """Get description for table entity

        Args:
            entity (table.Table): entity

        Returns:
            bool:
        """
        if not entity.description:
            return False

        for column in entity.columns:
            if not column.description:
                return False

        return True

    def _flatten_results(self, data: dict) -> Iterable[ReportData]:
        items = {}
        for key, value in data.items():
            items["entityType"] = ast.literal_eval(key) if key == "None" else key
            for key, value in value.items():
                items["team"] = ast.literal_eval(key) if key == "None" else key
                for key, value in value.items():
                    items["entityTier"] = (
                        ast.literal_eval(key) if key == "None" else key
                    )
                    yield ReportData(
                        timestamp=self.timestamp,
                        reportDataType=ReportDataType.EntityReportData.value,
                        data=EntityReportData.parse_obj({**items, **value}),
                    )  # type: ignore

    def fetch_data(self) -> Iterable[T]:
        for entity in ENTITIES:
            yield from self.metadata.list_all_entities(
                entity,
                fields="*",  # type: ignore
            )

    def refine(self) -> dict:
        """Aggegate data. We'll return a dictionary of the following shape

        {
            "entity_class": {
                "team_name": {
                    "tier": {
                        "missingDescription": <int>,
                        "missingOwner": <int>,
                        "hasOnwer": <int>,
                        "completedDescription": <int>,
                    }
                }
            }
        }

        Returns:
            dict:
        """
        refined_data = defaultdict(lambda: defaultdict(dict))
        for entity in self.fetch_data():
            data_blob_for_entity = {}
            team = self._get_team(entity.owner)
            try:
                entity_tier = self._get_entity_tier(entity.tags)
            except AttributeError:
                entity_tier = None
                logger.warning(
                    f"`tags` attribute not supported for entity type {entity.__class__.__name__}"  # pylint: disable=protected-access
                )
            entity_description = self._check_entity_description(entity)

            data_blob_for_entity["hasOwner"] = 1 if team else 0
            data_blob_for_entity["missingOwner"] = 0 if team else 1
            data_blob_for_entity["completedDescriptions"] = (
                1 if entity_description else 0
            )
            data_blob_for_entity["missingDescriptions"] = 0 if entity_description else 1
            data_blob_for_entity["entityCount"] = 1

            data_blob_for_entity_counter = Counter(data_blob_for_entity)

            if not refined_data[entity.__class__.__name__][str(team)].get(
                str(entity_tier)
            ):
                refined_data[entity.__class__.__name__][str(team)][
                    str(entity_tier)
                ] = data_blob_for_entity_counter
            else:
                refined_data[entity.__class__.__name__][str(team)][
                    str(entity_tier)
                ].update(data_blob_for_entity_counter)

        return refined_data

    def process(self) -> Iterable[ReportData]:
        refined_data: dict = self.refine()
        yield from self._flatten_results(refined_data)
