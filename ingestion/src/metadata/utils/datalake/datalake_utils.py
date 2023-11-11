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
from typing import Dict, List, Optional, cast

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.readers.dataframe.models import (
    DatalakeColumnWrapper,
    DatalakeTableSchemaWrapper,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes, get_df_reader
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
                separator=file_fqn.separator,
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


def unique_json_structure(dicts: List[Dict]) -> Dict:
    """Given a sample of `n` json objects, return a json object that represents the unique structure of all `n` objects.
    Note that the type of the key will be that of the last object seen in the sample.

    Args:
        dicts: list of json objects
    """
    result = {}
    for dict_ in dicts:
        for key, value in dict_.items():
            if isinstance(value, dict):
                nested_json = result.get(key, {})
                # `isinstance(nested_json, dict)` if for a key we first see a non dict value
                # but then see a dict value later, we will consider the key to be a dict.
                result[key] = unique_json_structure(
                    [nested_json if isinstance(nested_json, dict) else {}, value]
                )
            else:
                result[key] = value
    return result


def construct_json_column_children(json_column: Dict) -> List[Dict]:
    """Construt a dict representation of a Column object

    Args:
        json_column: unique json structure of a column
    """
    children = []
    for key, value in json_column.items():
        column = {}
        type_ = type(value).__name__.lower()
        column["dataTypeDisplay"] = DATALAKE_DATA_TYPES.get(
            type_, DataType.UNKNOWN
        ).value
        column["dataType"] = DATALAKE_DATA_TYPES.get(type_, DataType.UNKNOWN).value
        column["name"] = truncate_column_name(key)
        column["displayName"] = key
        if isinstance(value, dict):
            column["children"] = construct_json_column_children(value)
        children.append(column)

    return children


def get_children(json_column) -> List[Dict]:
    """Get children of json column.

    Args:
        json_column (pandas.Series): column with 100 sample rows.
            Sample rows will be used to infer children.
    """
    from pandas import Series  # pylint: disable=import-outside-toplevel

    json_column = cast(Series, json_column)
    try:
        json_column = json_column.apply(json.loads)
    except TypeError:
        # if values are not strings, we will assume they are already json objects
        # based on the read class logic
        pass
    json_structure = unique_json_structure(json_column.values.tolist())

    return construct_json_column_children(json_structure)


def get_columns(data_frame: "DataFrame"):
    """
    method to process column details
    """
    cols = []
    if hasattr(data_frame, "columns"):
        df_columns = list(data_frame.columns)
        for column in df_columns:
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

                if data_type == DataType.JSON:
                    parsed_string["children"] = get_children(
                        data_frame[column].dropna()[:100]
                    )

                cols.append(Column(**parsed_string))
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception parsing column [{column}]: {exc}")
    return cols


def fetch_col_types(data_frame, column_name):
    """fetch_col_types: Fetch Column Type for the c

    Args:
        data_frame (DataFrame)
        column_name (string)
    """
    data_type = None
    try:
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
