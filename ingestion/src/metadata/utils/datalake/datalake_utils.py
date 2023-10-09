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
import json
import traceback
from functools import reduce
from typing import List, Optional

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import truncate_column_name
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


def get_parent_col(data_frame, complex_cols, parent_col_fqn=""):
    """Get Complex Column Objects"""
    cols = []
    parent_cols = [top_level[0] for top_level in complex_cols if len(top_level) > 0]
    filter_unique = (
        lambda l, x: l  # pylint: disable=unnecessary-lambda-assignment
        if x in l
        else l + [x]
    )
    parent_cols = reduce(filter_unique, parent_cols, [])
    for top_level in parent_cols:
        if parent_col_fqn.startswith(COMPLEX_COLUMN_SEPARATOR) or not parent_col_fqn:
            col_fqn = COMPLEX_COLUMN_SEPARATOR.join([parent_col_fqn, top_level])
        else:
            col_fqn = COMPLEX_COLUMN_SEPARATOR.join(["", parent_col_fqn, top_level])
        col_obj = {
            "name": truncate_column_name(top_level),
            "displayName": top_level,
        }
        leaf_node = [
            leaf_parse[1:] for leaf_parse in complex_cols if top_level == leaf_parse[0]
        ]
        if any(leaf_node):
            col_obj["children"] = []
            col_obj["dataTypeDisplay"] = DataType.RECORD.value
            col_obj["dataType"] = DataType.RECORD
            col_obj["children"].extend(get_parent_col(data_frame, leaf_node, col_fqn))
        else:
            col_type = fetch_col_types(data_frame, col_fqn)
            col_obj["dataTypeDisplay"] = col_type.value
            col_obj["dataType"] = col_type
            col_obj["arrayDataType"] = (
                DataType.UNKNOWN if col_type == DataType.ARRAY else None
            )
        cols.append(Column(**col_obj))
    return cols


def get_columns(data_frame: "DataFrame"):
    """
    method to process column details
    """
    cols = []
    if hasattr(data_frame, "columns"):
        df_columns = list(data_frame.columns)
        for column in df_columns:
            if COMPLEX_COLUMN_SEPARATOR not in column:
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
    complex_cols = [
        complex_col.split(COMPLEX_COLUMN_SEPARATOR)[1:]
        for complex_col in json.loads(
            data_frame.apply(lambda row: row.to_json(), axis=1).values[0]
        ).keys()
        if COMPLEX_COLUMN_SEPARATOR in complex_col
    ]
    cols.extend(get_parent_col(data_frame, complex_cols))
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
                parsed_object = ast.literal_eval(str(df_row_val))
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
