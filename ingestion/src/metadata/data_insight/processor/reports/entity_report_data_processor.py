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
import traceback
from collections import Counter, defaultdict
from typing import Iterable, Optional, Type, TypeVar, cast

from metadata.data_insight.processor.reports.data_processor import DataProcessor
from metadata.generated.schema.analytics.reportData import ReportData, ReportDataType
from metadata.generated.schema.analytics.reportDataType.entityReportData import (
    EntityReportData,
)
from metadata.generated.schema.entity.data import (
    chart,
    container,
    dashboard,
    database,
    databaseSchema,
    mlmodel,
    pipeline,
    searchIndex,
    storedProcedure,
    table,
    topic,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.helpers import get_entity_tier_from_tags
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
    container.Container,
    storedProcedure.StoredProcedure,
    searchIndex.SearchIndex,
]

T = TypeVar("T", *ENTITIES)  # type: ignore


class EntityReportDataProcessor(DataProcessor):
    """Processor class used as a bridge to refine the data"""

    _data_processor_type = ReportDataType.EntityReportData.value

    def __init__(self, metadata: OpenMetadata):
        super().__init__(metadata)
        self._refined_data = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
        self.post_hook = self._post_hook_fn

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

        if isinstance(owner, EntityReferenceList):
            return owner.__root__[0].name

        if owner.type == "team":
            return owner.name

        owner_fqn = owner.fullyQualifiedName
        owner_fqn = cast(str, owner_fqn)  # To satisfy type checker

        entity_reference: Optional[User] = self.metadata.get_by_name(
            User, owner_fqn, fields=["teams"]
        )

        if not entity_reference:
            return None

        teams = entity_reference.teams

        if teams:
            return teams.__root__[0].name  # We'll return the first team listed

        return None

    def _check_entity_description(self, entity: T):
        """dispatch function

        Args:
            entity (T): entity

        Raises:
            TypeError: if single dispatch not implemented for the class
        """
        if isinstance(entity, table.Table):
            if not entity.description:
                return False

            for column in entity.columns:
                if not column.description:
                    return False

            return True

        if entity.description and not entity.description.__root__ == "":
            return True
        return False

    def _post_hook_fn(self) -> None:
        items = {}
        flattened_results = []
        for key, value in self._refined_data.items():
            items["serviceName"] = ast.literal_eval(key) if key == "None" else key
            for key, value in value.items():
                items["entityType"] = ast.literal_eval(key) if key == "None" else key
                for key, value in value.items():
                    items["team"] = ast.literal_eval(key) if key == "None" else key
                    for key, value in value.items():
                        items["entityTier"] = (
                            ast.literal_eval(key) if key == "None" else key
                        )
                        flattened_results.append({**items, **value})

        self._refined_data = flattened_results

    def yield_refined_data(self) -> Iterable[ReportData]:
        """Yield refined data"""
        for data in self._refined_data:
            yield ReportData(
                timestamp=self.timestamp,
                reportDataType=ReportDataType.EntityReportData.value,
                data=EntityReportData.parse_obj(data),
            )  # type: ignore

    def refine(self, entity: Type[T]) -> None:
        """Aggregate data. We'll return a dictionary of the following shape

        {
            "entity_class": {
                "team_name": {
                    "tier": {
                        "missingDescription": <int>,
                        "missingOwner": <int>,
                        "hasOwner": <int>,
                        "completedDescription": <int>,
                    }
                }
            }
        }

        Returns:
            dict:
        """
        data_blob_for_entity = {}
        try:
            team = (
                self._get_team(entity.owner)
                if not isinstance(entity, User)
                else self._get_team(entity.teams)  # type: ignore
            )
        except Exception:
            self.processor_status.failed(
                StackTraceError(
                    name=entity.name.__root__,
                    error="Error retrieving team",
                    stack_trace=traceback.format_exc(),
                )
            )
            raise

        try:
            entity_tier = get_entity_tier_from_tags(entity.tags)
        except AttributeError:
            entity_tier = None
            logger.warning(
                f"`tags` attribute not supported for entity type {entity.__class__.__name__}"
            )
            self.processor_status.warning(
                entity.__class__.__name__,
                "`tags` attribute not supported for entity type",
            )

        try:
            entity_description = self._check_entity_description(entity)
        except Exception as exc:
            entity_description = None
            logger.warning(
                f"`Something happened when retrieving description for entity type {entity.__class__.__name__}"
                f"-- {exc}"
            )
            self.processor_status.warning(
                entity.__class__.__name__,
                "`tags` attribute not supported for entity type",
            )

        if team:
            data_blob_for_entity["hasOwner"] = 1
            data_blob_for_entity["missingOwner"] = 0
        else:
            data_blob_for_entity["hasOwner"] = 0
            data_blob_for_entity["missingOwner"] = 1

        if entity_description:
            data_blob_for_entity["completedDescriptions"] = 1
            data_blob_for_entity["missingDescriptions"] = 0
        else:
            data_blob_for_entity["completedDescriptions"] = 0
            data_blob_for_entity["missingDescriptions"] = 1

        data_blob_for_entity["entityCount"] = 1

        data_blob_for_entity_counter = Counter(data_blob_for_entity)

        if not self._refined_data[str(entity.service.name)][entity.__class__.__name__][
            str(team)
        ].get(str(entity_tier)):
            self._refined_data[str(entity.service.name)][entity.__class__.__name__][
                str(team)
            ][str(entity_tier)] = data_blob_for_entity_counter
        else:
            self._refined_data[str(entity.service.name)][entity.__class__.__name__][
                str(team)
            ][str(entity_tier)].update(data_blob_for_entity_counter)

        self.processor_status.scanned(entity.name.__root__)

    def get_status(self):
        return self.processor_status
