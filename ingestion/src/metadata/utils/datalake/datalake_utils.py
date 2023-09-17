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
Module to define helper methods for datalake and to fetch data and metadata 
from different auths and different file systems.
"""
import ast
import traceback
from typing import List, Optional

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.ingestion.source.database.datalake.columns import clean_dataframe
from metadata.readers.dataframe.models import (
    DatalakeColumnWrapper,
    DatalakeTableSchemaWrapper,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes, get_df_reader
from metadata.utils.constants import COMPLEX_COLUMN_SEPARATOR
from metadata.utils.logger import utils_logger

logger = utils_logger()

DATALAKE_DATA_TYPES = {
    **dict.fromkeys(["int64", "int", "int32"], DataType.INT),
    "dict": DataType.JSON,
    "list": DataType.ARRAY,
    **dict.fromkeys(["float64", "float32", "float"], DataType.FLOAT),
    "bool": DataType.BOOLEAN,
    **dict.fromkeys(
        ["datetime64", "timedelta[ns]", "datetime64[ns]"], DataType.DATETIME
    ),
    "str": DataType.STRING,
}


def fetch_dataframe(
    config_source,
    client,
    file_fqn: DatalakeTableSchemaWrapper,
    **kwargs,
) -> Optional[List["DataFrame"]]:
    """
    Method to get dataframe for profiling
    """
    # dispatch to handle fetching of data from multiple file formats (csv, tsv, json, avro and parquet)
    key: str = file_fqn.key
    bucket_name: str = file_fqn.bucket_name
    try:
        file_extension: Optional[SupportedTypes] = file_fqn.file_extension or next(
            supported_type or None
            for supported_type in SupportedTypes
            if key.endswith(supported_type.value)
        )
        if file_extension and not key.endswith("/"):
            df_reader = get_df_reader(
                type_=file_extension,
                config_source=config_source,
                client=client,
            )
            try:
                df_wrapper: DatalakeColumnWrapper = df_reader.read(
                    key=key, bucket_name=bucket_name, **kwargs
                )
                return df_wrapper.dataframes
            except Exception as err:
                logger.error(
                    f"Error fetching file [{bucket_name}/{key}] using "
                    f"[{config_source.__class__.__name__}] due to: [{err}]"
                )
    except Exception as err:
        logger.error(
            f"Error fetching file [{bucket_name}/{key}] using [{config_source.__class__.__name__}] due to: [{err}]"
        )
        # Here we need to blow things up. Without the dataframe we cannot move forward
        raise err

    return None


def get_file_format_type(key_name, metadata_entry=None):
    for supported_types in SupportedTypes:
        if key_name.endswith(supported_types.value):
            return supported_types
        if metadata_entry:
            entry: list = [
                entry for entry in metadata_entry.entries if key_name == entry.dataPath
            ]
            if entry and supported_types.value == entry[0].structureFormat:
                return supported_types
    return False


def _parse_complex_column(
    data_frame,
    column,
    final_column_list: List[Column],
    complex_col_dict: dict,
    processed_complex_columns: set,
) -> None:
    """
    This class parses the complex columns

    for example consider this data:
        {
            "level1": {
                "level2":{
                    "level3": 1
                }
            }
        }

    pandas would name this column as: _##level1_##level2_##level3
    (_## being the custom separator)

    this function would parse this column name and prepare a Column object like
    Column(
        name="level1",
        dataType="RECORD",
        children=[
            Column(
                name="level2",
                dataType="RECORD",
                children=[
                    Column(
                        name="level3",
                        dataType="INT",
                    )
                ]
            )
        ]
    )
    """
    try:
        # pylint: disable=bad-str-strip-call
        column_name = str(column).strip(COMPLEX_COLUMN_SEPARATOR)
        col_hierarchy = tuple(column_name.split(COMPLEX_COLUMN_SEPARATOR))
        parent_col: Optional[Column] = None
        root_col: Optional[Column] = None

        # here we are only processing col_hierarchy till [:-1]
        # because all the column/node before -1 would be treated
        # as a record and the column at -1 would be the column
        # having a primitive datatype
        # for example if col_hierarchy is ("image", "properties", "size")
        # then image would be the record having child properties which is
        # also a record  but the "size" will not be handled in this loop
        # as it will be of primitive type for ex. int
        for index, col_name in enumerate(col_hierarchy[:-1]):

            if complex_col_dict.get(col_hierarchy[: index + 1]):
                # if we have already seen this column fetch that column
                parent_col = complex_col_dict.get(col_hierarchy[: index + 1])
            else:
                # if we have not seen this column than create the column and
                # append to the parent if available
                intermediate_column = Column(
                    name=truncate_column_name(col_name),
                    displayName=col_name,
                    dataType=DataType.RECORD,
                    children=[],
                    dataTypeDisplay=DataType.RECORD.value,
                )
                if parent_col:
                    parent_col.children.append(intermediate_column)
                    root_col = parent_col
                parent_col = intermediate_column
                complex_col_dict[col_hierarchy[: index + 1]] = parent_col

        # prepare the leaf node
        # use String as default type
        data_type = DataType.STRING
        if hasattr(data_frame[column], "dtypes"):
            data_type = fetch_col_types(data_frame, column_name=column)

        leaf_column = Column(
            name=col_hierarchy[-1],
            dataType=data_type,
            dataTypeDisplay=data_type.value,
            arrayDataType=DataType.UNKNOWN if data_type == DataType.ARRAY else None,
        )

        parent_col.children.append(leaf_column)

        # finally add the top level node in the column list
        if col_hierarchy[0] not in processed_complex_columns:
            processed_complex_columns.add(col_hierarchy[0])
            final_column_list.append(root_col or parent_col)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Unexpected exception parsing column [{column}]: {exc}")


def get_columns(data_frame: "DataFrame"):
    """
    method to process column details
    """
    data_frame = clean_dataframe(data_frame)
    cols = []
    complex_col_dict = {}

    processed_complex_columns = set()
    if hasattr(data_frame, "columns"):
        df_columns = list(data_frame.columns)
        for column in df_columns:
            if COMPLEX_COLUMN_SEPARATOR in column:
                _parse_complex_column(
                    data_frame,
                    column,
                    cols,
                    complex_col_dict,
                    processed_complex_columns,
                )
            else:
                # use String by default
                data_type = DataType.STRING
                try:
                    if hasattr(data_frame[column], "dtypes"):
                        data_type = fetch_col_types(data_frame, column_name=column)

                    parsed_string = {
                        "dataTypeDisplay": data_type.value,
                        "dataType": data_type,
                        "name": truncate_column_name(column),
                        "displayName": column,
                    }
                    if data_type == DataType.ARRAY:
                        parsed_string["arrayDataType"] = DataType.UNKNOWN

                    cols.append(Column(**parsed_string))
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception parsing column [{column}]: {exc}"
                    )
    complex_col_dict.clear()
    return cols


def fetch_col_types(data_frame, column_name):
    """fetch_col_types: Fetch Column Type for the c

    Args:
        data_frame (DataFrame)
        column_name (string)
    """
    try:
        data_type = None
        if data_frame[column_name].dtypes.name == "object" and any(
            data_frame[column_name].dropna().values
        ):
            try:
                # Safely evaluate the input string
                df_row_val = data_frame[column_name].dropna().values[0]
                parsed_object = ast.literal_eval(df_row_val)
                # Determine the data type of the parsed object
                data_type = type(parsed_object).__name__.lower()
            except (ValueError, SyntaxError):
                # Handle any exceptions that may occur
                data_type = "string"

        data_type = DATALAKE_DATA_TYPES.get(
            data_type or data_frame[column_name].dtypes.name, DataType.STRING
        )
    except Exception as err:
        logger.warning(
            f"Failed to distinguish data type for column {column_name}, Falling back to {data_type}, exc: {err}"
        )
        logger.debug(traceback.format_exc())
    return data_type
