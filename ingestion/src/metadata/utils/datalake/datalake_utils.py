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
import random
import traceback
from typing import Any, Dict, List, Optional, Union, cast

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.parsers.json_schema_parser import parse_json_schema
from metadata.readers.dataframe.models import (
    DatalakeColumnWrapper,
    DatalakeTableSchemaWrapper,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes, get_df_reader
from metadata.utils.logger import utils_logger

logger = utils_logger()


def fetch_dataframe(
    config_source,
    client,
    file_fqn: DatalakeTableSchemaWrapper,
    fetch_raw_data: bool = False,
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
                if fetch_raw_data:
                    return df_wrapper.dataframes, df_wrapper.raw_data
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

    if fetch_raw_data:
        return None, None
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


# pylint: disable=import-outside-toplevel
class DataFrameColumnParser:
    """A column parser object. This serves as a Creator class for the appropriate column parser object parser
    for datalake types. It allows us to implement different schema parsers for different datalake types without
    implementing many conditionals statements.

    e.g. if we want to implement a column parser for parquet files, we can simply implement a
    ParquetDataFrameColumnParser class and add it as part of the `create` method. The `create` method will then return
    the appropriate parser based on the file type. The `ColumnParser` class has a single entry point `get_columns` which
    will call the `get_columns` method of the appropriate parser.
    """

    def __init__(self, parser):
        """Initialize the column parser object"""
        self.parser = parser

    @classmethod
    def create(
        cls,
        data_frame: "DataFrame",
        file_type: Optional[SupportedTypes] = None,
        sample: bool = True,
        shuffle: bool = False,
        raw_data: Any = None,
    ):
        """Instantiate a column parser object with the appropriate parser

        Args:
            data_frame: the dataframe object
            file_type: the file type of the dataframe. Will be used to determine the appropriate parser.
            sample: whether to sample the dataframe or not if we have a list of dataframes.
                If sample is False, we will concatenate the dataframes, which can be cause OOM error for large dataset.
                (default: True)
            shuffle: whether to shuffle the dataframe list or not if sample is True. (default: False)
        """
        data_frame = cls._get_data_frame(data_frame, sample, shuffle)
        if file_type == SupportedTypes.PARQUET:
            parser = ParquetDataFrameColumnParser(data_frame)
        elif file_type in {
            SupportedTypes.JSON,
            SupportedTypes.JSONGZ,
            SupportedTypes.JSONZIP,
        }:
            parser = JsonDataFrameColumnParser(data_frame, raw_data=raw_data)
        else:
            parser = GenericDataFrameColumnParser(data_frame)
        return cls(parser)

    @staticmethod
    def _get_data_frame(
        data_frame: Union[List["DataFrame"], "DataFrame"], sample: bool, shuffle: bool
    ):
        """Return the dataframe to use for parsing"""
        import pandas as pd

        if not isinstance(data_frame, list):
            return data_frame

        if sample:
            if shuffle:
                random.shuffle(data_frame)
            return data_frame[0]

        return pd.concat(data_frame)

    def get_columns(self):
        """Get the columns from the parser"""
        return self.parser.get_columns()


class GenericDataFrameColumnParser:
    """Given a dataframe object, parse the columns and return a list of Column objects.

    # TODO: We should consider making the function above part of the `GenericDataFrameColumnParser` class
    # though we need to do a thorough overview of where they are used to ensure unnecessary coupling.
    """

    _data_formats = {
        **dict.fromkeys(["int64", "int", "int32"], DataType.INT),
        "dict": DataType.JSON,
        "list": DataType.ARRAY,
        **dict.fromkeys(["float64", "float32", "float"], DataType.FLOAT),
        "bool": DataType.BOOLEAN,
        **dict.fromkeys(
            ["datetime64[ns]", "datetime"],
            DataType.DATETIME,
        ),
        "timedelta[ns]": DataType.TIME,
        "str": DataType.STRING,
        "bytes": DataType.BYTES,
    }

    def __init__(self, data_frame: "DataFrame", raw_data: Any = None):
        self.data_frame = data_frame
        self.raw_data = raw_data

    def get_columns(self):
        """
        method to process column details
        """
        return self._get_columns(self.data_frame)

    @classmethod
    def _get_columns(cls, data_frame: "DataFrame"):
        """
        method to process column details.

        Note this was move from a function to a class method to bring it closer to the
        `GenericDataFrameColumnParser` class. Should be rethought as part of the TODO.
        """
        cols = []
        if hasattr(data_frame, "columns"):
            df_columns = list(data_frame.columns)
            for column in df_columns:
                # use String by default
                data_type = DataType.STRING
                try:
                    if hasattr(data_frame[column], "dtypes"):
                        data_type = cls.fetch_col_types(data_frame, column_name=column)

                    parsed_string = {
                        "dataTypeDisplay": data_type.value,
                        "dataType": data_type,
                        "name": truncate_column_name(column),
                        "displayName": column,
                    }
                    if data_type == DataType.ARRAY:
                        parsed_string["arrayDataType"] = DataType.UNKNOWN

                    if data_type == DataType.JSON:
                        parsed_string["children"] = cls.get_children(
                            data_frame[column].dropna()[:100]
                        )

                    cols.append(Column(**parsed_string))
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception parsing column [{column}]: {exc}"
                    )
        return cols

    @classmethod
    def fetch_col_types(cls, data_frame, column_name):
        """fetch_col_types: Fetch Column Type for the c

        Note this was move from a function to a class method to bring it closer to the
        `GenericDataFrameColumnParser` class. Should be rethought as part of the TODO.

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
                    df_row_val_list = data_frame[column_name].dropna().values[:1000]
                    parsed_object_datatype_list = []
                    for df_row_val in df_row_val_list:
                        try:
                            parsed_object_datatype_list.append(
                                type(ast.literal_eval(str(df_row_val))).__name__.lower()
                            )
                        except (ValueError, SyntaxError):
                            # we try to parse the value as a datetime, if it fails, we fallback to string
                            # as literal_eval will fail for string
                            from datetime import datetime

                            from dateutil.parser import ParserError, parse

                            try:
                                dtype_ = "int64"
                                if not str(df_row_val).isnumeric():
                                    # check if the row value is time
                                    try:
                                        datetime.strptime(df_row_val, "%H:%M:%S").time()
                                        dtype_ = "timedelta[ns]"
                                    except (ValueError, TypeError):
                                        # check if the row value is date / time / datetime
                                        type(parse(df_row_val)).__name__.lower()
                                        dtype_ = "datetime64[ns]"
                                parsed_object_datatype_list.append(dtype_)
                            except (ParserError, TypeError):
                                parsed_object_datatype_list.append("str")
                        except Exception as err:
                            logger.debug(
                                f"Failed to parse datatype for column {column_name}, exc: {err},"
                                "Falling back to string."
                            )
                            parsed_object_datatype_list.append("str")

                    data_type = max(parsed_object_datatype_list)
                    # Determine the data type of the parsed object

                except (ValueError, SyntaxError):
                    # Handle any exceptions that may occur
                    data_type = "string"

            data_type = cls._data_formats.get(
                data_type or data_frame[column_name].dtypes.name,
            )
            if not data_type:
                logger.debug(
                    f"unknown data type {data_frame[column_name].dtypes.name}. resolving to string."
                )
            data_type = data_type or DataType.STRING
        except Exception as err:
            logger.warning(
                f"Failed to distinguish data type for column {column_name}, Falling back to {data_type}, exc: {err}"
            )
            logger.debug(traceback.format_exc())
        return data_type

    @classmethod
    def unique_json_structure(cls, dicts: List[Dict]) -> Dict:
        """Given a sample of `n` json objects, return a json object that represents the unique
        structure of all `n` objects. Note that the type of the key will be that of
        the last object seen in the sample.

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
                    result[key] = cls.unique_json_structure(
                        [nested_json if isinstance(nested_json, dict) else {}, value]
                    )
                else:
                    result[key] = value
        return result

    @classmethod
    def construct_json_column_children(cls, json_column: Dict) -> List[Dict]:
        """Construt a dict representation of a Column object

        Args:
            json_column: unique json structure of a column
        """
        children = []
        for key, value in json_column.items():
            column = {}
            type_ = type(value).__name__.lower()
            column["dataTypeDisplay"] = cls._data_formats.get(
                type_, DataType.UNKNOWN
            ).value
            column["dataType"] = cls._data_formats.get(type_, DataType.UNKNOWN).value
            column["name"] = truncate_column_name(key)
            column["displayName"] = key
            if isinstance(value, dict):
                column["children"] = cls.construct_json_column_children(value)
            children.append(column)

        return children

    @classmethod
    def get_children(cls, json_column) -> List[Dict]:
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
        json_structure = cls.unique_json_structure(json_column.values.tolist())

        return cls.construct_json_column_children(json_structure)


# pylint: disable=import-outside-toplevel
class ParquetDataFrameColumnParser:
    """Given a dataframe object generated from a parquet file, parse the columns and return a list of Column objects."""

    def __init__(self, data_frame: "DataFrame"):
        import pyarrow as pa

        self._data_formats = {
            **dict.fromkeys(
                ["int8", "int16", "int32", "int64", "int", pa.DurationType],
                DataType.INT,
            ),
            **dict.fromkeys(
                ["uint8", "uint16", "uint32", "uint64", "uint"], DataType.UINT
            ),
            pa.StructType: DataType.STRUCT,
            **dict.fromkeys([pa.ListType, pa.LargeListType], DataType.ARRAY),
            **dict.fromkeys(
                ["halffloat", "float32", "float64", "double", "float"], DataType.FLOAT
            ),
            "bool": DataType.BOOLEAN,
            **dict.fromkeys(
                [
                    "datetime64",
                    "timedelta[ns]",
                    "datetime64[ns]",
                    "time32[s]",
                    "time32[ms]",
                    "time64[ns]",
                    "time64[us]",
                    pa.TimestampType,
                    "date64",
                ],
                DataType.DATETIME,
            ),
            "date32[day]": DataType.DATE,
            "string": DataType.STRING,
            **dict.fromkeys(
                ["binary", "large_binary", pa.FixedSizeBinaryType], DataType.BINARY
            ),
            **dict.fromkeys([pa.Decimal128Type, pa.Decimal256Type], DataType.DECIMAL),
        }

        self.data_frame = data_frame
        self._arrow_table = pa.Table.from_pandas(self.data_frame)

    def get_columns(self):
        """
        method to process column details for parquet files
        """
        import pyarrow as pa

        schema: List[pa.Field] = self._arrow_table.schema
        columns = []
        for column in schema:
            parsed_column = {
                "dataTypeDisplay": str(column.type),
                "dataType": self._get_pq_data_type(column),
                "name": truncate_column_name(column.name),
                "displayName": column.name,
            }

            if parsed_column["dataType"] == DataType.ARRAY:
                try:
                    item_field = column.type.value_field
                    parsed_column["arrayDataType"] = self._get_pq_data_type(item_field)
                except AttributeError:
                    # if the value field is not specified, we will set it to UNKNOWN
                    parsed_column["arrayDataType"] = DataType.UNKNOWN

            if parsed_column["dataType"] == DataType.BINARY:
                try:
                    # Either we an int number or -1
                    data_length = int(type(column.type).byte_width)
                except Exception as exc:
                    # if the byte width is not specified, we will set it to -1
                    # following pyarrow convention
                    data_length = -1
                    logger.debug("Could not extract binary field length due to %s", exc)
                parsed_column["dataLength"] = data_length

            if parsed_column["dataType"] == DataType.STRUCT:
                parsed_column["children"] = self._get_children(column)
            columns.append(Column(**parsed_column))

        return columns

    def _get_children(self, column):
        """For struct types, get the children of the column

        Args:
            column (pa.Field): pa column
        """
        field_idx = column.type.num_fields

        children = []
        for idx in range(field_idx):
            child = column.type.field(idx)
            data_type = self._get_pq_data_type(child)

            child_column = {
                "dataTypeDisplay": str(child.type),
                "dataType": data_type,
                "name": truncate_column_name(child.name),
                "displayName": child.name,
            }
            if data_type == DataType.STRUCT:
                child_column["children"] = self._get_children(child)
            children.append(child_column)

        return children

    def _get_pq_data_type(self, column):
        """Given a column return the type of the column

        Args:
            column (pa.Field): pa column
        """
        import pyarrow as pa

        if isinstance(
            column.type,
            (
                pa.DurationType,
                pa.StructType,
                pa.ListType,
                pa.LargeListType,
                pa.TimestampType,
                pa.Decimal128Type,
                pa.Decimal256Type,
                pa.FixedSizeBinaryType,
            ),
        ):
            # the above type can take many shape
            # (i.e. pa.ListType(pa.StructType([pa.column("a", pa.int64())])), etc,)
            # so we'll use their type to determine the data type
            data_type = self._data_formats.get(type(column.type), DataType.UNKNOWN)
        else:
            # for the other types we need to use their string representation
            # to determine the data type as `type(column.type)` will return
            # a generic `pyarrow.lib.DataType`
            data_type = self._data_formats.get(str(column.type), DataType.UNKNOWN)

        return data_type


class JsonDataFrameColumnParser(GenericDataFrameColumnParser):
    """Given a dataframe object generated from a json file, parse the columns and return a list of Column objects."""

    def get_columns(self):
        """
        method to process column details for json files
        """
        if self.raw_data:
            try:
                return parse_json_schema(schema_text=self.raw_data, cls=Column)
            except Exception as exc:
                logger.warning(f"Unable to parse the json schema: {exc}")
                logger.debug(traceback.format_exc())
        return self._get_columns(self.data_frame)
