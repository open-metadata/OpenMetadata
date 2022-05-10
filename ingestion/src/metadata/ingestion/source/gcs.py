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
"""gc source module"""

import uuid
from typing import Iterable, List, Optional, Union

from google.cloud import storage

from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.policies.lifecycle.deleteAction import (
    LifecycleDeleteAction,
)
from metadata.generated.schema.entity.policies.lifecycle.moveAction import (
    Destination,
    LifecycleMoveAction,
)
from metadata.generated.schema.entity.policies.lifecycle.rule import LifecycleRule
from metadata.generated.schema.entity.policies.policy import Policy, PolicyType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.storage import GcsStorageClass, StorageServiceType
from metadata.ingestion.api.common import ConfigModel, Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_policy import OMetaPolicy
from metadata.utils.helpers import get_storage_service_or_create
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class GcsSourceConfig(ConfigModel):
    """GCS source pydantic config module"""

    service_name: str


class GcsSource(Source[Entity]):
    """GCS source entity

    Args:
        config:
        GcsSourceConfig:
        metadata_config:
    Attributes:
        config:
        status:
        service:
        gcs:
    """

    config: GcsSourceConfig
    status: SourceStatus

    def __init__(
        self, config: GcsSourceConfig, metadata_config: OpenMetadataConnection
    ):
        super().__init__()
        self.config = config
        self.status = SourceStatus()
        self.service = get_storage_service_or_create(
            service_json={
                "name": self.config.service_name,
                "serviceType": StorageServiceType.GCS,
            },
            metadata_config=metadata_config,
        )
        self.gcs = storage.Client()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = GcsSourceConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[OMetaPolicy]:
        try:
            for bucket in self.gcs.list_buckets():
                self.status.scanned(bucket.name)
                location_path = self._get_bucket_name_with_prefix(bucket.name)
                location_id = uuid.uuid4()
                location = Location(
                    id=location_id,
                    name=bucket.name,
                    path=location_path,
                    displayName=bucket.name,
                    locationType=LocationType.Bucket,
                    service=EntityReference(
                        id=self.service.id,
                        type="storageService",
                        name=self.service.name,
                    ),
                )
                policy_name = f"{bucket.name}-lifecycle-policy"

                # Retrieve lifecycle policy and rules for the bucket.
                rules: List[LifecycleRule] = []
                for rule in bucket.lifecycle_rules:
                    rule = self._get_rule(rule, location, policy_name)
                    if rule:
                        rules.append(rule)

                policy = Policy(
                    id=uuid.uuid4(),
                    name=policy_name,
                    displayName=policy_name,
                    description=policy_name,
                    policyType=PolicyType.Lifecycle,
                    rules=rules,
                    enabled=True,
                )
                yield OMetaPolicy(
                    location=location,
                    policy=policy,
                )
        except Exception as err:  # pylint: disable=broad-except
            self.status.failure("error", str(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    @staticmethod
    def _get_bucket_name_with_prefix(bucket_name: str) -> str:
        return (
            "gs://" + bucket_name
            if not bucket_name.startswith("gs://")
            else bucket_name
        )

    def _get_rule(
        self, rule: dict, location: Location, policy_name: str
    ) -> Optional[LifecycleRule]:
        actions: List[Union[LifecycleDeleteAction, LifecycleMoveAction]] = []

        if "action" not in rule or "type" not in rule["action"]:
            return None

        name = policy_name

        if rule["action"]["type"] == "SetStorageClass":
            storage_class = rule["action"]["storageClass"]
            actions.append(
                LifecycleMoveAction(
                    daysAfterCreation=rule["condition"]["age"],
                    destination=Destination(
                        storageServiceType=self.service,
                        storageClassType=GcsStorageClass(
                            rule["action"]["storageClass"]
                        ),
                        location=location,
                    ),
                )
            )
            name = f"{policy_name}-move-{storage_class.lower()}"

        if rule["action"]["type"] == "Delete":
            actions.append(
                LifecycleDeleteAction(daysAfterCreation=rule["condition"]["age"])
            )
            name = f"{policy_name}-delete"

        return LifecycleRule(
            actions=actions,
            # gcs bucket lifecycle policies do not have an enabled field, hence True.
            enabled=True,
            name=name,
        )

    def test_connection(self) -> None:
        pass
