#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Pydantic definition for storing entities for patching
"""
import json
import logging
import traceback
from typing import Dict, List, Optional, Tuple

import jsonpatch
from pydantic import BaseModel

from metadata.ingestion.api.models import Entity, T
from metadata.ingestion.ometa.mixins.patch_mixin_utils import PatchOperation
from metadata.ingestion.ometa.utils import model_str

logger = logging.getLogger("metadata")


class PatchRequest(BaseModel):
    """
    Store the original and new entities for patch
    """

    original_entity: Entity
    new_entity: Entity
    override_metadata: Optional[bool] = False


class PatchedEntity(BaseModel):
    """
    Store the new entity after patch request
    """

    new_entity: Optional[Entity] = None


ALLOWED_COLUMN_FIELDS = {
    "name": True,
    "displayName": True,
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
    "owners": True,
    "tags": True,
    "sourceHash": True,
    "entityStatus": True,
    "reviewers": True,
    # Table Entity Fields
    "tableType": True,
    "columns": {"__all__": ALLOWED_COLUMN_FIELDS},
    "tableConstraints": True,
    "tablePartition": True,
    "location": True,
    "locationPath": True,
    "schemaDefinition": True,
    "sampleData": True,
    "fileFormat": True,
    # Stored Procedure Fields
    "storedProcedureCode": True,
    "storedProcedureType": True,
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
    "extension": True,
}

RESTRICT_UPDATE_LIST = [
    "description",
    "tags",
    "owners",
    "displayName",
    "tableConstraints",
    "extension",
]

ARRAY_ENTITY_FIELDS = ["columns", "tasks", "fields"]


PathTuple = Tuple[str]


# For each 'replace to None' operation we will add a Remove operation at the end.
# This helps up prevent sending to the backend lists with None values for instance.
#
# Obs: The `replace to None` operations are created by the jsonpatch library.
#
# Example
# ----
# Initial:
# [
#   {"op": "replace", "path": "/path/1", "value": None},
#   {"op": "add",     "path": "/path/2", "value": "foo"},
# ]
#
# Final:
# [
#   {"op": "replace", "path": "/path/1", "value": None},
#   {"op": "add",     "path": "/path/2", "value": "foo"},
#   {"op": "remove",  "path": "/path/1"},
# ]
class ReplaceWithNoneOpFixer:
    """Responsible for creating the Remove operations that fix every
    Replace to None ones.

    It is important to keep the state of the index drift in order to
    create a working patch.

    Example:

        Initial:
        [
            {"op": "replace", "path": "/path/1", "value": None},
            {"op": "replace", "path": "/path/2", "value": None}
        ]

       Final:
        [
            {"op": "replace", "path": "/path/1", "value": None},
            {"op": "replace", "path": "/path/2", "value": None},
            {"op": "remove",  "path": "/path/1"},
            {"op": "remove",  "path": "/path/1"}
        ]

        Since the first Remove operation is relative to the first replace, there is no drift.
        When the second Remove operation happens however, the first one would have already been done.
        This means that '/path/2' becomes '/path/1'.
    """

    def __init__(self, index_drift_map: Dict[PathTuple, int]):
        self.index_drift_map = index_drift_map

    @classmethod
    def default(cls) -> "ReplaceWithNoneOpFixer":
        """Instantiates the ReplaceWithNoOpFixer with an empty drift map."""
        return cls(index_drift_map={})

    def _fix_index_drift(self, path: List[str]):
        """Modifies the incoming path depending on how many Remove operations we have already
        registered for this path."""

        # We check all the paths for which we already registered a Remove operation
        for drifted_path, drift in self.index_drift_map.items():
            # If any of them matches the start of the current path we update the index.
            if path[: len(drifted_path)] == list(drifted_path):
                try:
                    drift_location = len(drifted_path)
                    path[drift_location] = str(int(path[drift_location]) - drift)
                except ValueError:
                    # Not in a List. No need to fix the Path Index
                    continue
        return path

    def _update_index_drift_map(self, path: List[str]):
        """Update the dirft map with the seen path."""
        path_tuple: PathTuple = tuple(path[:-1])

        self.index_drift_map[path_tuple] = (
            self.index_drift_map.setdefault(path_tuple, 0) + 1
        )

    def _get_remove_operation(self, path: List[str]) -> Dict:
        """Return a JSONPatch Remove operation for the given path."""
        return {"op": PatchOperation.REMOVE.value, "path": "/".join(path)}

    def get_remove_operation(self, path: List[str]):
        """Returns a JSONPatch Remove operation for the given path
        while keeping in the state that we are sending a Remove operation
        for the given path."""
        fixed_path = self._fix_index_drift(path)

        self._update_index_drift_map(fixed_path)

        return self._get_remove_operation(fixed_path)


class JsonPatchUpdater:
    """Reponsible for applying any custom changes to the JSONPatch generated by the jsonpatch library."""

    def __init__(
        self,
        restrict_update_fields: List,
        replace_with_none_op_fixer: ReplaceWithNoneOpFixer,
    ):
        self.restrict_update_fields = restrict_update_fields
        self.replace_with_none_op_fixer = replace_with_none_op_fixer

    @classmethod
    def from_restrict_update_fields(
        cls, restrict_update_fields: List
    ) -> "JsonPatchUpdater":
        """Instantiates a JsonPatchUpdater based on the restric_update_fields"""
        return cls(
            restrict_update_fields=restrict_update_fields,
            replace_with_none_op_fixer=ReplaceWithNoneOpFixer.default(),
        )

    def _determine_restricted_operation(
        self, patch_ops: Dict, override_metadata: bool
    ) -> bool:
        """
        Only retain add operation for restrict_update_fields fields
        """
        path = patch_ops.get("path")
        ops = patch_ops.get("op")
        for field in self.restrict_update_fields or []:
            if field in path:
                # if we have overrideMetadata enabled we will allow ADD and REPLACE operations
                if override_metadata:
                    # REMOVE operations will be skipped since this removes any data on the field
                    # that is added by the user, if the source has no data on the field
                    if ops == PatchOperation.REMOVE.value:
                        return False
                    return True
                # if we have overrideMetadata disabled we will only allow ADD operations
                if ops != PatchOperation.ADD.value:
                    return False
        return True

    def _is_replace_with_none_operation(self, patch_ops: dict) -> bool:
        """Check if the Operation is a Replace operation to a None value."""
        return (patch_ops.get("op") == PatchOperation.REPLACE.value) and (
            patch_ops.get("value") is None
        )

    def _get_remove_operation_for_replace_with_none(self, path: str) -> Dict:
        """Returns the Remove operation for the given Path. Used to fix the Replace to None operations."""
        return self.replace_with_none_op_fixer.get_remove_operation(path.split("/"))

    def update(
        self, patch: jsonpatch.JsonPatch, override_metadata: bool = False
    ) -> List:
        """Given a JSONPatch generated by the jsonpatch library, updates it based on our custom needs.
        1. Remove any restricted operations
        2. Fix any 'Replace to None' operation by adding a 'Remove' operation at the end.
        """
        patch_ops_list = []
        remove_ops_list = []

        for patch_ops in patch.patch or []:
            if self._determine_restricted_operation(
                patch_ops=patch_ops, override_metadata=override_metadata
            ):
                patch_ops_list.append(patch_ops)

                if self._is_replace_with_none_operation(patch_ops):
                    remove_ops_list.append(
                        self._get_remove_operation_for_replace_with_none(
                            patch_ops["path"]
                        )
                    )

        patch_ops_list.extend(remove_ops_list)

        return patch_ops_list


def build_patch(
    source: T,
    destination: T,
    allowed_fields: Optional[Dict] = None,
    restrict_update_fields: Optional[List] = None,
    array_entity_fields: Optional[List] = None,
    remove_change_description: bool = True,
    override_metadata: Optional[bool] = False,
    skip_on_failure: Optional[bool] = True,
) -> Optional[jsonpatch.JsonPatch]:
    """
    Given an Entity type and Source entity and Destination entity,
    generate a JSON Patch and apply it.

    Args
        source: Source payload which is current state of the source in OpenMetadata
        destination: payload with changes applied to the source.
        allowed_fields: List of field names to filter from source and destination models
        restrict_update_fields: List of field names which will only support add operation
        array_entity_fields: List of array fields to sort for consistent patching
        remove_change_description: Whether to remove change description from entities
        override_metadata: Whether to override existing metadata fields
        skip_on_failure: Whether to skip the patch operation on failure (default: True)

    Returns
        Updated Entity
    """
    try:
        # remove change descriptions from entities
        if remove_change_description:
            source = _remove_change_description(source)
            destination = _remove_change_description(destination)

        if array_entity_fields:
            _sort_array_entity_fields(
                source=source,
                destination=destination,
                array_entity_fields=array_entity_fields,
                restrict_update_fields=restrict_update_fields,
                override_metadata=override_metadata,
            )

        # special handler for tableConstraints
        _table_constraints_handler(source, destination)

        # Determine which array entity fields are present in allowed_fields
        active_array_fields = set()
        if array_entity_fields:
            for field in array_entity_fields:
                if allowed_fields is None or field in allowed_fields:
                    active_array_fields.add(field)

        # Exclude array entity fields from the position-based jsonpatch diff.
        # They are handled via full "replace" operations to preserve correct
        # ordering when columns are added/removed/reordered.
        if allowed_fields:
            non_array_allowed = {
                k: v for k, v in allowed_fields.items() if k not in active_array_fields
            }
            if non_array_allowed:
                patch = jsonpatch.make_patch(
                    json.loads(
                        source.model_dump_json(
                            exclude_unset=True,
                            exclude_none=True,
                            include=non_array_allowed,
                        )
                    ),
                    json.loads(
                        destination.model_dump_json(
                            exclude_unset=True,
                            exclude_none=True,
                            include=non_array_allowed,
                        )
                    ),
                )
            else:
                patch = jsonpatch.JsonPatch([])
        else:
            array_exclude = (
                {f: True for f in active_array_fields} if active_array_fields else None
            )
            patch = jsonpatch.make_patch(
                json.loads(
                    source.model_dump_json(
                        exclude_unset=True,
                        exclude_none=True,
                        exclude=array_exclude,
                    )
                ),
                json.loads(
                    destination.model_dump_json(
                        exclude_unset=True,
                        exclude_none=True,
                        exclude=array_exclude,
                    )
                ),
            )

        # Add full "replace" operations for array entity fields whose
        # content changed.  The merge in _sort_array_entity_fields already
        # applied the restrict_update_fields / override_metadata logic, so
        # the replacement value is ready to use as-is.
        for field in active_array_fields:
            if hasattr(source, field) and hasattr(destination, field):
                src_json = json.loads(
                    source.model_dump_json(
                        exclude_unset=True,
                        exclude_none=True,
                        include={field: True},
                    )
                )
                dst_json = json.loads(
                    destination.model_dump_json(
                        exclude_unset=True,
                        exclude_none=True,
                        include={field: True},
                    )
                )
                if src_json.get(field) != dst_json.get(field):
                    patch.patch.append(
                        {
                            "op": "replace",
                            "path": f"/{field}",
                            "value": dst_json.get(field, []),
                        }
                    )

        if not patch.patch:
            return None

        # For user-editable fields like descriptions and tags we only want
        # to support "add" operations in the patch.  Array entity field
        # "replace" operations (e.g. /columns) pass through because their
        # paths do not contain restricted field names.
        if restrict_update_fields:
            updated_operations = JsonPatchUpdater.from_restrict_update_fields(
                restrict_update_fields
            ).update(patch, override_metadata=override_metadata)
            patch.patch = updated_operations

        return patch
    except Exception as exc:
        logger.debug(traceback.format_exc())
        if skip_on_failure:
            entity_info = ""
            try:
                if hasattr(source, "fullyQualifiedName"):
                    entity_info = f" for '{source.fullyQualifiedName.root}'"
                elif hasattr(source, "name"):
                    entity_info = f" for '{source.name.root}'"
            except Exception:
                pass

            logger.warning(
                f"Failed to build patch{entity_info}. The patch generation was skipped. "
                f"Reason: {exc}"
            )
            return None
        else:
            entity_info = ""
            try:
                if hasattr(source, "fullyQualifiedName"):
                    entity_info = f" for '{source.fullyQualifiedName.root}'"
                elif hasattr(source, "name"):
                    entity_info = f" for '{source.name.root}'"
            except Exception:
                pass

            raise RuntimeError(
                f"Failed to build patch{entity_info}. The patch generation failed. "
                f"Set 'skip_on_failure=True' to skip failed patch operations. Error: {exc}"
            ) from exc


def _get_attribute_name(attr: T) -> str:
    """Get the attribute name from the attribute."""
    if hasattr(attr, "name"):
        return model_str(attr.name)
    return model_str(attr)


def rearrange_attributes(final_attributes: List[T], source_attributes: List[T]):
    source_staging_list = []
    destination_staging_list = []
    for attribute in final_attributes or []:
        if attribute in source_attributes:
            source_staging_list.append(attribute)
        else:
            destination_staging_list.append(attribute)
    return source_staging_list + destination_staging_list


def _table_constraints_handler(source: T, destination: T):
    """
    Handle table constraints patching properly.
    This ensures we only perform allowed operations on constraints and maintain the structure.
    """
    if not hasattr(source, "tableConstraints") or not hasattr(
        destination, "tableConstraints"
    ):
        return

    source_table_constraints = getattr(source, "tableConstraints")
    destination_table_constraints = getattr(destination, "tableConstraints")

    if not source_table_constraints or not destination_table_constraints:
        return

    # Create a dictionary of source constraints for easy lookup
    source_constraints_dict = {}
    for constraint in source_table_constraints:
        # Create a unique key based on constraintType and columns
        key = f"{constraint.constraintType}:{','.join(sorted(constraint.columns))}"
        source_constraints_dict[key] = constraint

    # Rearrange destination constraints to match source order when possible
    rearranged_constraints = []

    # First add constraints that exist in both source and destination (preserving order from source)
    for source_constraint in source_table_constraints:
        key = f"{source_constraint.constraintType}:{','.join(sorted(source_constraint.columns))}"
        for dest_constraint in destination_table_constraints:
            dest_key = f"{dest_constraint.constraintType}:{','.join(sorted(dest_constraint.columns))}"
            if key == dest_key:
                rearranged_constraints.append(dest_constraint)
                break

    # Then add new constraints from destination that don't exist in source
    for dest_constraint in destination_table_constraints:
        dest_key = f"{dest_constraint.constraintType}:{','.join(sorted(dest_constraint.columns))}"
        if dest_key not in source_constraints_dict:
            rearranged_constraints.append(dest_constraint)

    # Update the destination constraints with the rearranged list
    setattr(destination, "tableConstraints", rearranged_constraints)


def _should_update_restricted_field(
    source_value, dest_value, override_metadata: bool
) -> bool:
    """Decide whether a restricted field should be updated from destination.

    Mirrors the restrict_update_fields filter semantics:
    - ADD   (source empty → dest has value): always allowed
    - REPLACE (both have values):           only with override
    - REMOVE  (source has value → dest empty): never allowed
    """
    source_empty = source_value is None or (
        isinstance(source_value, list) and len(source_value) == 0
    )
    dest_empty = dest_value is None or (
        isinstance(dest_value, list) and len(dest_value) == 0
    )
    if dest_empty:
        return False
    if source_empty:
        return True
    return override_metadata


def _sort_array_entity_fields(
    source: T,
    destination: T,
    array_entity_fields: Optional[List] = None,
    restrict_update_fields: Optional[List] = None,
    override_metadata: Optional[bool] = False,
):
    """
    Reorder array entity fields to match the destination order (the actual
    source database column order), while merging metadata from source
    (the existing entity in OpenMetadata) for columns that already exist.

    The merge respects restrict_update_fields / override_metadata so the
    resulting array can be used as a full replacement value without further
    filtering.
    """
    restrict_set = set(restrict_update_fields or [])

    for field in array_entity_fields or []:
        if hasattr(destination, field) and hasattr(source, field):
            destination_attributes = getattr(destination, field)
            source_attributes = getattr(source, field)

            source_dict = {
                _get_attribute_name(attr): attr for attr in source_attributes
            }

            updated_attributes = []
            for dest_attr in destination_attributes or []:
                source_attr = source_dict.get(_get_attribute_name(dest_attr))
                if source_attr:
                    update_dict = {}
                    for k, v in dest_attr.__dict__.items():
                        if k not in dest_attr.model_fields_set:
                            continue
                        if k in restrict_set:
                            src_val = getattr(source_attr, k, None)
                            if not _should_update_restricted_field(
                                src_val, v, override_metadata
                            ):
                                continue
                        update_dict[k] = v
                    updated_attributes.append(
                        source_attr.model_copy(update=update_dict)
                    )
                else:
                    updated_attributes.append(dest_attr)

            for idx, attr in enumerate(updated_attributes):
                if hasattr(attr, "ordinalPosition"):
                    attr.ordinalPosition = idx + 1

            setattr(destination, field, updated_attributes)


def _remove_change_description(entity: T) -> T:
    """
    Remove change description if applies.
    We never want to patch that, and we won't have that information
    from the source. It's fully handled in the server.
    """
    if hasattr(entity, "changeDescription") and getattr(entity, "changeDescription"):
        entity.changeDescription = None

    return entity
