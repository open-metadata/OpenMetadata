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
Pydantic definition for storing entities for patching 
"""
import json
from typing import Dict, List, Optional

import jsonpatch
from pydantic import BaseModel

from metadata.ingestion.api.models import Entity, T
from metadata.ingestion.ometa.mixins.patch_mixin_utils import PatchOperation


class PatchRequest(BaseModel):
    """
    Store the original and new entities for patch
    """

    original_entity: Entity
    new_entity: Entity


class PatchedEntity(BaseModel):
    """
    Store the new entity after patch request
    """

    new_entity: Optional[Entity]


ALLOWED_COLUMN_FIELDS = {
    "name": True,
    "dataType": True,
    "arrayDataType": True,
    "description": True,
    "tags": True,
    "dataLength": True,
    "constraint": True,
    "children": True,
    "ordinalPosition": True,
    "precision": True,
    "scale": True,
    "dataTypeDisplay": True,
    "jsonSchema": True,
}

ALLOWED_TASK_FIELDS = {
    "name": True,
    "displayName": True,
    "sourceUrl": True,
    "downstreamTasks": True,
    "taskType": True,
    "taskSQL": True,
    "startDate": True,
    "endDate": True,
}

ALLOWED_ENTITY_REFERENCE_FIELDS = {"id": True, "type": True}

ALLOWED_CONTAINER_DATAMODEL_FIELDS = {
    "isPartitioned": True,
    "columns": {"__all__": ALLOWED_COLUMN_FIELDS},
}

ALLOWED_COMMON_PATCH_FIELDS = {
    # Common Entity Fields
    "name": True,
    "displayName": True,
    "sourceUrl": True,
    "description": True,
    "owner": True,
    "tags": True,
    "sourceHash": True,
    # Table Entity Fields
    "tableType": True,
    "columns": {"__all__": ALLOWED_COLUMN_FIELDS},
    "tableConstraints": True,
    "tablePartition": True,
    "location": True,
    "viewDefinition": True,
    "sampleData": True,
    "fileFormat": True,
    # Stored Procedure Fields
    "storedProcedureCode": True,
    "code": True,
    # Dashboard Entity Fields
    "chartType": True,
    "project": True,
    "dashboardType": True,
    "charts": {"__all__": ALLOWED_ENTITY_REFERENCE_FIELDS},
    "dataModels": {"__all__": ALLOWED_ENTITY_REFERENCE_FIELDS},
    # Pipeline Entity Fields
    "concurrency": True,
    "pipelineLocation": True,
    "startDate": True,
    "scheduleInterval": True,
    "tasks": {"__all__": ALLOWED_TASK_FIELDS},
    # Topic Entity Fields
    "messageSchema": True,
    "partitions": True,
    "cleanupPolicies": True,
    "retentionTime": True,
    "replicationFactor": True,
    "maximumMessageSize": True,
    "minimumInSyncReplicas": True,
    "retentionSize": True,
    "topicConfig": True,
    # MlModel Entity Fields
    "algorithm": True,
    "mlFeatures": True,
    "mlHyperParameters": True,
    "target": True,
    "dashboard": ALLOWED_ENTITY_REFERENCE_FIELDS,
    "mlStore": True,
    "server": True,
    # SearchIndex Entity Fields
    "fields": {"__all__": ALLOWED_COLUMN_FIELDS},
    "searchIndexSettings": True,
    # Container Entity Fields
    "parent": ALLOWED_ENTITY_REFERENCE_FIELDS,
    "children": {"__all__": ALLOWED_ENTITY_REFERENCE_FIELDS},
    "dataModel": ALLOWED_CONTAINER_DATAMODEL_FIELDS,
    "prefix": True,
    "numberOfObjects": True,
    "size": True,
    "fileFormats": True,
}

RESTRICT_UPDATE_LIST = ["description", "tags", "owner"]


def build_patch(
    source: T,
    destination: T,
    allowed_fields: Optional[Dict] = None,
    restrict_update_fields: Optional[List] = None,
) -> Optional[jsonpatch.JsonPatch]:
    """
    Given an Entity type and Source entity and Destination entity,
    generate a JSON Patch and apply it.

    Args
        source: Source payload which is current state of the source in OpenMetadata
        destination: payload with changes applied to the source.
        allowed_fields: List of field names to filter from source and destination models
        restrict_update_fields: List of field names which will only support add operation

    Returns
        Updated Entity
    """

    # remove change descriptions from entities
    source = _remove_change_description(source)
    destination = _remove_change_description(destination)

    # Get the difference between source and destination
    if allowed_fields:
        patch = jsonpatch.make_patch(
            json.loads(
                source.json(
                    exclude_unset=True,
                    exclude_none=True,
                    include=allowed_fields,
                )
            ),
            json.loads(
                destination.json(
                    exclude_unset=True,
                    exclude_none=True,
                    include=allowed_fields,
                )
            ),
        )
    else:
        patch: jsonpatch.JsonPatch = jsonpatch.make_patch(
            json.loads(source.json(exclude_unset=True, exclude_none=True)),
            json.loads(destination.json(exclude_unset=True, exclude_none=True)),
        )
    if not patch:
        return None

    # for a user editable fields like descriptions, tags we only want to support "add" operation in patch
    # we will remove the other operations for replace, remove from here
    if restrict_update_fields:
        patch.patch = [
            patch_ops
            for patch_ops in patch.patch
            if _determine_restricted_operation(
                patch_ops=patch_ops,
                restrict_update_fields=restrict_update_fields,
            )
        ]

    return patch


def _determine_restricted_operation(
    patch_ops: Dict, restrict_update_fields: Optional[List] = None
) -> bool:
    """
    Only retain add operation for restrict_update_fields fields
    """
    path = patch_ops.get("path")
    ops = patch_ops.get("op")
    for field in restrict_update_fields or []:
        if field in path and ops != PatchOperation.ADD.value:
            return False
    return True


def _remove_change_description(entity: T) -> T:
    """
    Remove change description if applies.
    We never want to patch that, and we won't have that information
    from the source. It's fully handled in the server.
    """
    if getattr(entity, "changeDescription"):
        entity.changeDescription = None

    return entity
