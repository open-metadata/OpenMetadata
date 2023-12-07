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
from pydantic import BaseModel

from metadata.ingestion.api.models import Entity


class PatchRequest(BaseModel):
    """
    Store the original and new entities for patch
    """

    original_entity: Entity
    new_entity: Entity


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
    "tags": True,
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

RESTRICT_UPDATE_LIST = ["description", "tags"]
