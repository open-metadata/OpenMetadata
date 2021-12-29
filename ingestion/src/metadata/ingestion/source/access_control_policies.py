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

import json
import logging
import uuid
from collections import Iterable
from typing import Optional

from metadata.generated.schema.entity.policies.policy import Policy
from metadata.ingestion.api.common import Entity, ConfigModel, WorkflowContext
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_policy import OMetaPolicy
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger: logging.Logger = logging.getLogger(__name__)


class AccessControlPoliciesConfig(ConfigModel):
    policies_file: str


class AccessControlPoliciesSource(Source[Entity]):
    config: AccessControlPoliciesConfig
    status: SourceStatus
    policies_data: Optional[dict] = None

    def __init__(
        self,
        config: AccessControlPoliciesConfig,
        metadata_config: MetadataServerConfig,
        ctx,
    ):
        self.config = config
        self.status = SourceStatus()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = AccessControlPoliciesConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        try:
            with open(self.config.policies_file, "r") as f:
                self.policies_data = json.load(f)
        except Exception as e:
            logger.fatal(
                f"Please ensure that the configured policies_file is set up correctly - {e}"
            )

    def next_record(self) -> Iterable[OMetaPolicy]:
        try:
            for policy in self.policies_data["policies"]:
                # add a generated policy id to reduce overhead of maintaining one for every policy in policies file.
                policy["id"] = uuid.uuid4()
                self.status.scanned(policy)
                yield OMetaPolicy(policy=Policy.parse_obj(policy))
        except Exception as e:
            self.status.failure("error", str(e))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass  # nothing to close.
