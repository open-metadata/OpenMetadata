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
Mixin class containing PATCH specific methods

To be used by OpenMetadata class
"""
import json
import traceback
from typing import Dict, Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table, TableConstraint
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.patch import (
    PatchField,
    PatchOperation,
    PatchPath,
    PatchValue,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.helpers import find_column_in_table_with_index
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)

OWNER_TYPES: List[str] = ["user", "team"]


class OMetaPatchMixin(Generic[T]):
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def _fetch_entity_if_exists(
        self, entity: Type[T], entity_id: Union[str, basic.Uuid]
    ) -> Optional[T]:
        """
        Validates if we can update a description or not. Will return
        the instance if it can be updated. None otherwise.

        Args
            entity (T): Entity Type
            entity_id: ID
            description: new description to add
            force: if True, we will patch any existing description. Otherwise, we will maintain
                the existing data.
        Returns
            instance to update
        """

        instance = self.get_by_id(entity=entity, entity_id=entity_id, fields=["*"])

        if not instance:
            logger.warning(
                f"Cannot find an instance of '{entity.__class__.__name__}' with id [{str(entity_id)}]."
            )
            return None

        return instance

    def patch_description(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        description: str,
        force: bool = False,
    ) -> Optional[T]:
        """
        Given an Entity type and ID, JSON PATCH the description.

        Args
            entity (T): Entity Type
            entity_id: ID
            description: new description to add
            force: if True, we will patch any existing description. Otherwise, we will maintain
                the existing data.
        Returns
            Updated Entity
        """
        instance = self._fetch_entity_if_exists(entity=entity, entity_id=entity_id)
        if not instance:
            return None

        if instance.description and not force:
            logger.warning(
                f"The entity with id [{model_str(entity_id)}] already has a description."
                " To overwrite it, set `force` to True."
            )
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            PatchField.OPERATION: PatchOperation.ADD
                            if not instance.description
                            else PatchOperation.REPLACE,
                            PatchField.PATH: PatchPath.DESCRIPTION,
                            PatchField.VALUE: description,
                        }
                    ]
                ),
            )
            return entity(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH description for {entity.__class__.__name__} [{entity_id}]: {exc}"
            )

        return None

    def patch_column_description(
        self,
        entity_id: Union[str, basic.Uuid],
        column_name: str,
        description: str,
        force: bool = False,
    ) -> Optional[T]:
        """Given an Entity ID, JSON PATCH the description of the column

        Args
            entity_id: ID
            description: new description to add
            column_name: column to update
            force: if True, we will patch any existing description. Otherwise, we will maintain
                the existing data.
        Returns
            Updated Entity
        """
        table: Table = self._validate_instance_description(
            entity=Table,
            entity_id=entity_id,
        )
        if not table:
            return None

        if not table.columns:
            return None

        col_index, col = find_column_in_table_with_index(
            column_name=column_name, table=table
        )

        if col_index is None:
            logger.warning(f"Cannot find column {column_name} in Table.")
            return None

        if col.description and not force:
            logger.warning(
                f"The column '{column_name}' in '{table.fullyQualifiedName.__root__}' already has a description."
                " To overwrite it, set `force` to True."
            )
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            PatchField.OPERATION: PatchOperation.ADD
                            if not col.description
                            else PatchOperation.REPLACE,
                            PatchField.PATH: PatchPath.COLUMNS_DESCRIPTION.format(
                                index=col_index
                            ),
                            PatchField.VALUE: description,
                        }
                    ]
                ),
            )
            return Table(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PATCH description for Table Column: {entity_id}, {column_name}: {exc}"
            )

        return None

    def patch_table_constraints(
        self,
        entity_id: Union[str, basic.Uuid],
        table_constraints: List[TableConstraint],
    ) -> Optional[T]:
        """Given an Entity ID, JSON PATCH the table constraints of table

        Args
            entity_id: ID
            description: new description to add
            table_constraints: table constraints to add

        Returns
            Updated Entity
        """
        table: Table = self._fetch_entity_if_exists(
            entity=Table,
            entity_id=entity_id,
        )
        if not table:
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD if not table.tableConstraints else REPLACE,
                            PATH: TABLE_CONSTRAINTS,
                            VALUE: [
                                {
                                    "constraintType": constraint.constraintType.value,
                                    "columns": constraint.columns,
                                    "referredColumns": [
                                        col.__root__
                                        for col in constraint.referredColumns or []
                                    ],
                                }
                                for constraint in table_constraints
                            ],
                        }
                    ]
                ),
            )
            return Table(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PATCH description for Table Constraint: {entity_id}: {exc}"
            )

        return None

    def patch_tag(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        tag_fqn: str,
        from_glossary: bool = False,
        operation: Union[
            PatchOperation.ADD, PatchOperation.REMOVE
        ] = PatchOperation.ADD,
    ) -> Optional[T]:
        """
        Given an Entity type and ID, JSON PATCH the tag.

        Args
            entity (T): Entity Type
            entity_id: ID
            description: new description to add
            force: if True, we will patch any existing description. Otherwise, we will maintain
                the existing data.
        Returns
            Updated Entity
        """
        instance = self._validate_instance_description(
            entity=entity, entity_id=entity_id
        )
        if not instance:
            return None

        tag_index = len(instance.tags) - 1 if instance.tags else 0

        try:
            res = None
            if operation == PatchOperation.ADD:
                res = self.client.patch(
                    path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.TAGS.format(
                                    tag_index=tag_index
                                ),
                                PatchField.VALUE: {
                                    "labelType": LabelType.Automated.value,
                                    "source": TagSource.Classification.value
                                    if not from_glossary
                                    else TagSource.Glossary.value,
                                    "state": State.Confirmed.value,
                                    "tagFQN": tag_fqn,
                                },
                            }
                        ]
                    ),
                )
            elif operation == PatchOperation.REMOVE:
                res = self.client.patch(
                    path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.REMOVE,
                                PatchField.PATH: PatchPath.TAGS.format(
                                    tag_index=tag_index
                                ),
                            }
                        ]
                    ),
                )
            return entity(**res) if res is not None else res

        except Exception as exc:
            logger.error(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH tag for {entity.__class__.__name__} [{entity_id}]: {exc}"
            )

        return None

    def patch_column_tag(
        self,
        entity_id: Union[str, basic.Uuid],
        column_name: str,
        tag_fqn: str,
        from_glossary: bool = False,
        operation: Union[
            PatchOperation.ADD, PatchOperation.REMOVE
        ] = PatchOperation.ADD,
        is_suggested: bool = False,
    ) -> Optional[T]:
        """Given an Entity ID, JSON PATCH the tag of the column

        Args
            entity_id: ID
            tag_fqn: new tag to add
            column_name: column to update
            from_glossary: the tag comes from a glossary
        Returns
            Updated Entity
        """
        table: Table = self._fetch_entity_if_exists(entity=Table, entity_id=entity_id)
        if not table:
            return None

        col_index, col = find_column_in_table_with_index(
            column_name=column_name, table=table
        )

        if col_index is None:
            logger.warning(f"Cannot find column {column_name} in Table.")
            return None

        tag_index = len(col.tags) - 1 if col.tags else 0
        try:
            res = None
            if operation == PatchOperation.ADD:
                res = self.client.patch(
                    path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                PatchField.OPERATION: PatchOperation.ADD,
                                PatchField.PATH: PatchPath.COLUMNS_TAGS.format(
                                    index=col_index, tag_index=tag_index
                                ),
                                PatchField.VALUE: {
                                    PatchValue.LABEL_TYPE: LabelType.Automated.value,
                                    PatchValue.SOURCE: TagSource.Classification.value
                                    if not from_glossary
                                    else TagSource.Glossary.value,
                                    PatchValue.STATE: State.Suggested.value
                                    if is_suggested
                                    else State.Confirmed.value,
                                    PatchValue.TAG_FQN: tag_fqn,
                                },
                            }
                        ]
                    ),
                )
            elif operation == PatchOperation.REMOVE:
                res = self.client.patch(
                    path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                    data=json.dumps(
                        [
                            {
                                OPERATION: REMOVE,
                                PATH: COL_TAG.format(
                                    index=col_index, tag_index=tag_index
                                ),
                            }
                        ]
                    ),
                )
            return Table(**res) if res is not None else res

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error trying to PATCH tags for Table Column: {entity_id}, {column_name}: {exc}"
            )

        return None

    def patch_owner(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        owner: EntityReference = None,
        force: bool = False,
    ) -> Optional[T]:
        """
        Given an Entity type and ID, JSON PATCH the owner. If not owner Entity type and
        not owner ID are provided, the owner is removed.

        Args
            entity (T): Entity Type of the entity to be patched
            entity_id: ID of the entity to be patched
            owner: Entity Reference of the owner. If None, the owner will be removed
            force: if True, we will patch any existing owner. Otherwise, we will maintain
                the existing data.
        Returns
            Updated Entity
        """
        instance = self._fetch_entity_if_exists(entity=entity, entity_id=entity_id)
        if not instance:
            return None

        # Don't change existing data without force
        if instance.owner and not force:
            logger.warning(
                f"The entity with id [{model_str(entity_id)}] already has an owner."
                " To overwrite it, set `overrideOwner` to True."
            )
            return None

        data: Dict = {
            PatchField.PATH: PatchPath.OWNER,
        }

        if owner is None:
            data[PatchField.OPERATION] = PatchOperation.REMOVE
        else:
            if owner.type not in OWNER_TYPES:
                valid_owner_types: str = ", ".join(f'"{o}"' for o in OWNER_TYPES)
                logger.error(
                    f"The entity with id [{model_str(entity_id)}] was provided an invalid"
                    f" owner type. Must be one of {valid_owner_types}."
                )
                return None

            data[PatchField.OPERATION] = (
                PatchOperation.ADD if instance.owner is None else PatchOperation.REPLACE
            )
            data[PatchField.VALUE] = {
                PatchValue.ID: model_str(owner.id),
                PatchValue.TYPE: owner.type,
            }

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                data=json.dumps([data]),
            )
            return entity(**res)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error trying to PATCH description for {entity.__class__.__name__} [{entity_id}]: {exc}"
            )

        return None
