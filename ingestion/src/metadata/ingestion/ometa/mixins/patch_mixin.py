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
from typing import Generic, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.tagLabel import LabelType, State, TagSource
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, ometa_logger
from metadata.utils.helpers import find_column_in_table_with_index

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)

OPERATION = "op"
PATH = "path"
VALUE = "value"

# Operations
ADD = "add"
REPLACE = "replace"

# OM specific description handling
ENTITY_DESCRIPTION = "/description"
COL_DESCRIPTION = "/columns/{index}/description"

ENTITY_TAG = "/tags/{tag_index}"
COL_TAG = "/columns/{index}/tags/{tag_index}"


class OMetaPatchMixin(Generic[T]):
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def _validate_instance_description(
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
        instance = self._validate_instance_description(
            entity=entity, entity_id=entity_id
        )
        if not instance:
            return None

        if instance.description and not force:
            logger.warning(
                f"The entity with id [{str(entity_id)}] already has a description."
                " To overwrite it, set `force` to True."
            )
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(entity)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD if not instance.description else REPLACE,
                            PATH: ENTITY_DESCRIPTION,
                            VALUE: description,
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
                f"The column '{column_name}' in '{table.displayName}' already has a description."
                " To overwrite it, set `force` to True."
            )
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD if not col.description else REPLACE,
                            PATH: COL_DESCRIPTION.format(index=col_index),
                            VALUE: description,
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

    def patch_tag(
        self,
        entity: Type[T],
        entity_id: Union[str, basic.Uuid],
        tag_fqn: str,
        from_glossary: bool = False,
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

        tag_index = len(instance.tags) if instance.tags else 0

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD,
                            PATH: ENTITY_TAG.format(tag_index=tag_index),
                            VALUE: {
                                "labelType": LabelType.Automated.value,
                                "source": TagSource.Tag.value
                                if not from_glossary
                                else TagSource.Glossary.value,
                                "state": State.Confirmed.value,
                                "tagFQN": tag_fqn,
                            },
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

    def patch_column_tag(
        self,
        entity_id: Union[str, basic.Uuid],
        column_name: str,
        tag_fqn: str,
        from_glossary: bool = False,
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
        table: Table = self._validate_instance_description(
            entity=Table, entity_id=entity_id
        )
        if not table:
            return None

        col_index, _ = find_column_in_table_with_index(
            column_name=column_name, table=table
        )

        if col_index is None:
            logger.warning(f"Cannot find column {column_name} in Table.")
            return None

        tag_index = len(table.tags) if table.tags else 0

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD,
                            PATH: COL_TAG.format(index=col_index, tag_index=tag_index),
                            VALUE: {
                                "labelType": LabelType.Automated.value,
                                "source": TagSource.Tag.value
                                if not from_glossary
                                else TagSource.Glossary.value,
                                "state": State.Confirmed.value,
                                "tagFQN": tag_fqn,
                            },
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
