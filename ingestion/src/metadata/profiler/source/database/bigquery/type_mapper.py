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
Type mapper for bigquery specific types
"""
from metadata.generated.schema.entity.data.table import Column, DataType


def bigquery_type_mapper(_type_map: dict, col: Column):
    """Map the bigquery data types to the sqlalchemy data types

    Args:
        _type_map (dict): a dict of bigquery data types to sqlalchemy data types
        col (Column): a column entity

    Returns:
        sqlalchemy data type
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_bigquery import STRUCT

    def build_struct(_type_map: dict, col: Column):
        structs = []
        for child in col.children:
            if child.dataType != DataType.STRUCT:
                if child.arrayDataType:
                    type_ = _type_map.get(child.dataType)(item_type=child.arrayDataType)
                else:
                    type_ = _type_map.get(child.dataType)
                structs.append((child.name.root, type_))
            else:
                nested_structs = build_struct(_type_map, child)
                structs.append((child.name.root, STRUCT(*nested_structs)))
        return structs

    return STRUCT(*build_struct(_type_map, col))
