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

import uuid
from typing import Iterable, List, Union

from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.policies.filters import Prefix
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
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.storage import S3StorageClass, StorageServiceType
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_policy import OMetaPolicy
from metadata.utils.aws_client import AWSClient
from metadata.utils.helpers import get_storage_service_or_create
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class S3SourceConfig(AWSCredentials):
    service_name: str


class S3Source(Source[Entity]):
    config: S3SourceConfig
    status: SourceStatus

    def __init__(self, config: S3SourceConfig, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.service = get_storage_service_or_create(
            service_json={
                "name": self.config.service_name,
                "serviceType": StorageServiceType.S3,
            },
            metadata_config=metadata_config,
        )
        self.s3 = AWSClient(self.config).get_client("s3")

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = S3SourceConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[OMetaPolicy]:
        try:
            buckets_response = self.s3.list_buckets()
            if not "Buckets" in buckets_response or not buckets_response["Buckets"]:
                return
            for bucket in buckets_response["Buckets"]:
                bucket_name = bucket["Name"]
                self.status.scanned(bucket_name)
                location_path = self._get_bucket_name_with_prefix(bucket_name)
                location_id = uuid.uuid4()
                location = Location(
                    id=location_id,
                    name=bucket_name,
                    path=location_path,
                    displayName=bucket_name,
                    locationType=LocationType.Bucket,
                    service=EntityReference(
                        id=self.service.id,
                        type="storageService",
                        name=self.service.name,
                    ),
                )

                # Retrieve lifecycle policy and rules for the bucket.
                rules: List[LifecycleRule] = []
                for rule in self.s3.get_bucket_lifecycle_configuration(
                    Bucket=bucket_name
                )["Rules"]:
                    rules.append(self._get_rule(rule, location))
                policy_name = f"{bucket_name}-lifecycle-policy"
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
        except Exception as e:
            self.status.failure("error", str(e))

    def get_status(self) -> SourceStatus:
        return self.status

    @staticmethod
    def _get_bucket_name_with_prefix(bucket_name: str) -> str:
        return (
            "s3://" + bucket_name
            if not bucket_name.startswith("s3://")
            else bucket_name
        )

    def close(self):
        pass

    def _get_rule(self, rule: dict, location: Location) -> LifecycleRule:
        actions: List[Union[LifecycleDeleteAction, LifecycleMoveAction]] = []
        if "Transitions" in rule:
            for transition in rule["Transitions"]:
                if "StorageClass" in transition and "Days" in transition:
                    actions.append(
                        LifecycleMoveAction(
                            daysAfterCreation=transition["Days"],
                            destination=Destination(
                                storageServiceType=self.service,
                                storageClassType=S3StorageClass(
                                    transition["StorageClass"]
                                ),
                                location=location,
                            ),
                        )
                    )
        if "Expiration" in rule and "Days" in rule["Expiration"]:
            actions.append(
                LifecycleDeleteAction(daysAfterCreation=rule["Expiration"]["Days"])
            )

        enabled = rule["Status"] == "Enabled" if "Status" in rule else False

        prefix_filter = None
        if "Filter" in rule and "Prefix" in rule["Filter"]:
            prefix_filter = Prefix.parse_obj(rule["Filter"]["Prefix"])

        name = rule["ID"] if "ID" in rule else None

        return LifecycleRule(
            actions=actions,
            enabled=enabled,
            prefixFilter=prefix_filter,
            name=name,
        )

    def test_connection(self) -> None:
        pass
