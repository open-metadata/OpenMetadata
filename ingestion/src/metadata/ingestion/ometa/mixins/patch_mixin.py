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
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, ometa_logger

logger = ometa_logger()

T = TypeVar("T", bound=BaseModel)  # pylint: disable=invalid-name

OPERATION = "op"
PATH = "path"
VALUE = "value"

# Operations
ADD = "add"
REPLACE = "replace"

# OM specific description handling
ENTITY_DESCRIPTION = "/description"
COL_DESCRIPTION = "/columns/{index}/description"


class OMetaPatchMixin(Generic[T]):
    """
    OpenMetadata API methods related to Tables.

    To be inherited by OpenMetadata
    """

    client: REST

    def _validate_instance_description(
        self, entity: Type[T], entity_id: Union[str, basic.Uuid], force: bool = False
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

        instance = self.get_by_id(entity=entity, entity_id=entity_id)

        if not instance:
            logger.warn(
                f"Cannot find an instance of {entity.__class__.__name__} with the given ID."
            )
            return None

        if instance.description and not force:
            logger.warn(
                f"The Entity already has a description. To overwrite it, set `force` to True."
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
            entity=entity, entity_id=entity_id, force=force
        )
        if not instance:
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
            logger.error(
                f"Error trying to PATCH description for {entity.__class__.__name__}: {entity_id} - {exc}"
            )
            logger.debug(traceback.format_exc())

    def patch_column_description(
        self,
        entity_id: Union[str, basic.Uuid],
        column_name: str,
        description: str,
        force: bool = False,
    ) -> Optional[T]:
        """
        Given an Entity type and ID, JSON PATCH the description of the column

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
            entity=Table, entity_id=entity_id, force=force
        )
        if not table:
            return None

        col_index, col = next(
            (
                (col_index, col)
                for col_index, col in enumerate(table.columns)
                if col.name.__root__ == column_name
            ),
            None,
        )

        if not col_index:
            logger.error(f"Cannot find column {column_name} in Table.")
            return None

        if col.description and not force:
            logger.warn(
                f"The Column already has a description. To overwrite it, set `force` to True."
            )
            return None

        try:
            res = self.client.patch(
                path=f"{self.get_suffix(Table)}/{model_str(entity_id)}",
                data=json.dumps(
                    [
                        {
                            OPERATION: ADD if not table.description else REPLACE,
                            PATH: COL_DESCRIPTION.format(index=col_index),
                            VALUE: description,
                        }
                    ]
                ),
            )
            return Table(**res)

        except Exception as exc:
            logger.error(
                f"Error trying to PATCH description for Table Column: {entity_id}, {column_name} - {exc}"
            )
            logger.debug(traceback.format_exc())
