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
Module to define helper methods for datalake and to fetch data and metadata
from different auths and different file systems.
"""

import ast
import json
import random
import re
import traceback
from typing import Any, Dict, List, Optional, cast  # noqa: UP035

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


class _ArrayOfStruct:
    """Marker for a JSON value observed as a list of dicts. Carries the merged struct shape
    so downstream column construction can render it as ARRAY<STRUCT<...>>."""

    __slots__ = ("struct",)

    def __init__(self, struct: Dict):  # noqa: UP006
        self.struct = struct


def fetch_dataframe_generator(
    config_source,
    client,
    file_fqn: DatalakeTableSchemaWrapper,
    session=None,
    **kwargs,
) -> Optional[DatalakeColumnWrapper]:  # noqa: UP045
    """Return the datafgrame generator

    Args:
        config_source: The configuration source for the datalake
        client: The client to use for fetching the data
        file_fqn: The fully qualified name of the file
        fetch_raw_data: Whether to fetch the raw data or not
        **kwargs: Additional arguments to pass to the reader

    Returns:
        DatalakeColumnWrapper: A wrapper containing the dataframes and raw data
    """
    # dispatch to handle fetching of data from multiple file formats (csv, tsv, json, avro and parquet)
    key: str = file_fqn.key
    bucket_name: str = file_fqn.bucket_name
    try:
        file_extension: Optional[SupportedTypes] = file_fqn.file_extension or next(  # noqa: UP045
            supported_type or None for supported_type in SupportedTypes if key.endswith(supported_type.value)
        )
        if file_extension and not key.endswith("/"):
            df_reader = get_df_reader(
                type_=file_extension,
                config_source=config_source,
                client=client,
                separator=file_fqn.separator,
                session=session,
            )
            try:
                return df_reader.read(
                    key=key,
                    bucket_name=bucket_name,
                    file_size=file_fqn.file_size,
                    **kwargs,
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error fetching file [{bucket_name}/{key}] using "
                    f"[{config_source.__class__.__name__}] due to: [{err}]"
                )
                raise err  # noqa: TRY201
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error fetching file [{bucket_name}/{key}] using [{config_source.__class__.__name__}] due to: [{err}]"
        )
        # Here we need to blow things up. Without the dataframe we cannot move forward
        raise err  # noqa: TRY201


def fetch_dataframe_first_chunk(
    config_source,
    client,
    file_fqn: DatalakeTableSchemaWrapper,
    fetch_raw_data: bool = False,
    session=None,
    **kwargs,
) -> Optional["DataFrame"]:  # noqa: F821
    """
    Method to get only the first chunk of a dataframe for schema inference.
    Avoids loading the entire file into memory.
    """
    key: str = file_fqn.key
    bucket_name: str = file_fqn.bucket_name
    try:
        file_extension: Optional[SupportedTypes] = file_fqn.file_extension or next(  # noqa: UP045
            supported_type or None for supported_type in SupportedTypes if key.endswith(supported_type.value)
        )
        if file_extension and not key.endswith("/"):
            df_reader = get_df_reader(
                type_=file_extension,
                config_source=config_source,
                client=client,
                separator=file_fqn.separator,
                session=session,
            )
            try:
                df_wrapper: DatalakeColumnWrapper = df_reader.read_first_chunk(
                    key=key,
                    bucket_name=bucket_name,
                    file_size=file_fqn.file_size,
                    **kwargs,
                )
                dataframes = df_wrapper.dataframes
                # Handle callable (generator function) - call it to get the iterator
                if callable(dataframes):
                    dataframes = dataframes()
                if fetch_raw_data:
                    return dataframes, df_wrapper.raw_data
                return dataframes  # noqa: TRY300
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error fetching first chunk of file [{bucket_name}/{key}] using "
                    f"[{config_source.__class__.__name__}] due to: [{err}]"
                )
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(
            f"Error fetching first chunk of file [{bucket_name}/{key}] using "
            f"[{config_source.__class__.__name__}] due to: [{err}]"
        )
        raise err  # noqa: TRY201

    if fetch_raw_data:
        return None, None
    return None


_ICEBERG_METADATA_PATH_RE = re.compile(r"([^/]+)/metadata/v\d+\.metadata\.json$")


def get_iceberg_table_name_from_metadata_path(metadata_path: str) -> str | None:
    """
    Extracts the Iceberg table directory name from a metadata file path.

    Examples:
      "warehouse/orders/metadata/v2.metadata.json"  -> "orders"
      "my_prefix/sales/metadata/v1.metadata.json"   -> "sales"
      "simple/metadata/v3.metadata.json"            -> "simple"
      "data/orders.json"                            -> None

    Returns None if the path does not match the Iceberg metadata pattern.
    """
    match = _ICEBERG_METADATA_PATH_RE.search(metadata_path)
    return match.group(1) if match else None


def get_file_format_type(key_name, metadata_entry=None):
    for supported_types in SupportedTypes:
        if key_name.lower().endswith(supported_types.value.lower()):
            return supported_types
        if metadata_entry:
            entry: list = [entry for entry in metadata_entry.entries if key_name == entry.dataPath]
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
        data_frame: "DataFrame",  # noqa: F821
        file_type: Optional[SupportedTypes] = None,  # noqa: UP045
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
        if file_type in {
            SupportedTypes.PARQUET,
            SupportedTypes.PARQUET_PQ,
            SupportedTypes.PARQUET_PQT,
            SupportedTypes.PARQUET_PARQ,
            SupportedTypes.PARQUET_SNAPPY,
        }:
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
        data_frame: list[Any] | Any,
        sample: bool,
        shuffle: bool,  # noqa: F821, RUF100
    ):
        """Return the dataframe to use for parsing"""

        import pandas as pd  # noqa: PLC0415

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

    _data_formats = {  # noqa: RUF012
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

    def __init__(self, data_frame: "DataFrame", raw_data: Any = None):  # noqa: F821
        self.data_frame = data_frame
        self.raw_data = raw_data

    def get_columns(self):
        """
        method to process column details
        """
        return self._get_columns(self.data_frame)

    @classmethod
    def _parse_column(cls, data_frame: "DataFrame", column: str) -> Optional[Column]:  # noqa: F821, UP045
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
                struct_children = cls._get_array_struct_children(data_frame[column].dropna()[:100])
                if struct_children:
                    parsed_string["arrayDataType"] = DataType.STRUCT
                    parsed_string["children"] = struct_children

            if data_type == DataType.JSON:
                parsed_string["children"] = cls.get_children(data_frame[column].dropna()[:100])

            return Column(**parsed_string)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception parsing column [{column}]: {exc}")
        return None

    @classmethod
    def _get_columns(cls, data_frame: "DataFrame"):  # noqa: F821
        """
        method to process column details.

        Note this was move from a function to a class method to bring it closer to the
        `GenericDataFrameColumnParser` class. Should be rethought as part of the TODO.
        """
        cols = []
        if hasattr(data_frame, "columns"):
            for column in list(data_frame.columns):
                parsed_col = cls._parse_column(data_frame, column)
                if parsed_col:
                    cols.append(parsed_col)
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
        data_type = None  # default to string
        try:
            if data_frame[column_name].dtypes.name == "object" and any(data_frame[column_name].dropna().values):
                try:
                    # Safely evaluate the input string
                    df_row_val_list = data_frame[column_name].dropna().values[:1000]
                    parsed_object_datatype_list = []
                    for df_row_val in df_row_val_list:
                        try:
                            parsed_object_datatype_list.append(type(ast.literal_eval(str(df_row_val))).__name__.lower())
                        except (ValueError, SyntaxError):
                            # we try to parse the value as a datetime, if it fails, we fallback to string
                            # as literal_eval will fail for string
                            from datetime import datetime  # noqa: PLC0415

                            from dateutil.parser import ParserError, parse  # noqa: PLC0415

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
                                f"Failed to parse datatype for column {column_name}, exc: {err},Falling back to string."
                            )
                            parsed_object_datatype_list.append("str")

                    data_type = max(parsed_object_datatype_list)
                    # Determine the data type of the parsed object

                except (ValueError, SyntaxError) as exc:
                    # Handle any exceptions that may occur
                    logger.debug(
                        f"ValueError/SyntaxError while parsing column '{column_name}' datatype: {exc}. "
                        f"Falling back to string."
                    )
                    data_type = "string"

            data_type = cls._data_formats.get(
                data_type or data_frame[column_name].dtypes.name,
            )
            if not data_type:
                logger.debug(f"unknown data type {data_frame[column_name].dtypes.name}. resolving to string.")
            data_type = data_type or DataType.STRING
        except Exception as err:
            logger.warning(
                f"Failed to distinguish data type for column {column_name}, Falling back to {data_type}, exc: {err}"
            )
            logger.debug(traceback.format_exc())
        return data_type or DataType.STRING

    @classmethod
    def _process_unique_json_key(cls, result: Dict, key: str, value: Any) -> None:  # noqa: UP006
        if isinstance(value, dict):
            nested_json = result.get(key, {})
            # `isinstance(nested_json, dict)` if for a key we first see a non dict value
            # but then see a dict value later, we will consider the key to be a dict.
            result[key] = cls.unique_json_structure([nested_json if isinstance(nested_json, dict) else {}, value])
        elif isinstance(value, list) and value and all(isinstance(item, dict) for item in value):
            merged_struct = cls.unique_json_structure(value)
            existing = result.get(key)
            existing_struct = existing.struct if isinstance(existing, _ArrayOfStruct) else {}
            result[key] = _ArrayOfStruct(cls.unique_json_structure([existing_struct, merged_struct]))
        else:
            result[key] = value

    @classmethod
    def unique_json_structure(cls, dicts: List[Dict]) -> Dict:  # noqa: UP006
        """Given a sample of `n` json objects, return a json object that represents the unique
        structure of all `n` objects. Note that the type of the key will be that of
        the last object seen in the sample.

        Args:
            dicts: list of json objects
        """
        result = {}
        for dict_ in dicts:
            for key, value in dict_.items():
                cls._process_unique_json_key(result, key, value)
        return result

    @classmethod
    def construct_json_column_children(cls, json_column: Dict) -> List[Dict]:  # noqa: UP006
        """Construt a dict representation of a Column object

        Args:
            json_column: unique json structure of a column
        """
        children = []
        for key, value in json_column.items():
            column = {}
            column["name"] = truncate_column_name(key)
            column["displayName"] = key
            if isinstance(value, _ArrayOfStruct):
                column["dataType"] = DataType.ARRAY.value
                column["dataTypeDisplay"] = DataType.ARRAY.value
                column["arrayDataType"] = DataType.STRUCT
                column["children"] = cls.construct_json_column_children(value.struct)
            else:
                type_ = type(value).__name__.lower()
                column["dataTypeDisplay"] = cls._data_formats.get(type_, DataType.UNKNOWN).value
                column["dataType"] = cls._data_formats.get(type_, DataType.UNKNOWN).value
                if isinstance(value, dict):
                    column["children"] = cls.construct_json_column_children(value)
            children.append(column)

        return children

    @classmethod
    def get_children(cls, json_column) -> List[Dict]:  # noqa: UP006
        """Get children of json column.

        Args:
            json_column (pandas.Series): column with 100 sample rows.
                Sample rows will be used to infer children.
        """
        from pandas import Series  # pylint: disable=import-outside-toplevel  # noqa: PLC0415

        json_column = cast(Series, json_column)  # noqa: TC006
        try:
            json_column = json_column.apply(json.loads)
        except TypeError as exc:
            # if values are not strings, we will assume they are already json objects
            # based on the read class logic
            logger.debug(
                f"TypeError while parsing JSON column children: {exc}. Assuming values are already JSON objects."
            )
        json_structure = cls.unique_json_structure(json_column.values.tolist())

        return cls.construct_json_column_children(json_structure)

    @classmethod
    def _get_array_struct_children(cls, array_column: Any) -> List[Dict]:  # noqa: UP006
        """For an ARRAY column whose elements are dicts, infer the merged struct shape and
        return it as children. Returns an empty list when elements are not dicts.
        """
        flattened = []
        for value in array_column.values.tolist():
            if isinstance(value, str):
                try:
                    value = json.loads(value)  # noqa: PLW2901
                except (TypeError, ValueError):
                    continue
            if isinstance(value, dict):
                flattened.append(value)
            elif isinstance(value, list):
                flattened.extend(item for item in value if isinstance(item, dict))
        if not flattened:
            return []
        merged_struct = cls.unique_json_structure(flattened)
        return cls.construct_json_column_children(merged_struct)


# pylint: disable=import-outside-toplevel
class ParquetDataFrameColumnParser:
    """Given a dataframe object generated from a parquet file, parse the columns and return a list of Column objects."""

    def __init__(self, data_frame: "DataFrame"):  # noqa: F821
        import pyarrow as pa  # noqa: PLC0415

        self._data_formats = {
            **dict.fromkeys(
                ["int8", "int16", "int32", "int64", "int", pa.DurationType],
                DataType.INT,
            ),
            **dict.fromkeys(["uint8", "uint16", "uint32", "uint64", "uint"], DataType.UINT),
            pa.StructType: DataType.STRUCT,
            **dict.fromkeys([pa.ListType, pa.LargeListType], DataType.ARRAY),
            **dict.fromkeys(["halffloat", "float32", "float64", "double", "float"], DataType.FLOAT),
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
            **dict.fromkeys(["binary", "large_binary", pa.FixedSizeBinaryType], DataType.BINARY),
            **dict.fromkeys([pa.Decimal128Type, pa.Decimal256Type], DataType.DECIMAL),
        }

        self.data_frame = data_frame
        self._arrow_table = pa.Table.from_pandas(self.data_frame)

    def get_columns(self):
        """
        method to process column details for parquet files
        """
        import pyarrow as pa  # noqa: PLC0415, TC002

        schema: List[pa.Field] = self._arrow_table.schema  # noqa: UP006
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
                except AttributeError as exc:
                    # if the value field is not specified, we will set it to UNKNOWN
                    logger.debug(
                        f"Could not extract array item type for column '{column.name}': {exc}. "
                        f"Setting arrayDataType to UNKNOWN."
                    )
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
        import pyarrow as pa  # noqa: PLC0415

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
                # First, check if this is an Iceberg/Delta Lake metadata file
                data = json.loads(self.raw_data)
                if self._is_iceberg_delta_metadata(data):
                    return self._parse_iceberg_delta_schema(data)
                # Otherwise, try to parse as standard JSON Schema
                return parse_json_schema(schema_text=self.raw_data, cls=Column)
            except Exception as exc:
                logger.warning(f"Unable to parse the json schema: {exc}")
                logger.debug(traceback.format_exc())
        return self._get_columns(self.data_frame)

    def _is_iceberg_delta_metadata(self, data: dict) -> bool:
        """
        Check if the JSON data is an Iceberg or Delta Lake metadata file.
        These files have a specific structure with 'schema' containing 'fields'.
        """
        return (
            isinstance(data, dict)
            and "schema" in data
            and isinstance(data["schema"], dict)
            and "fields" in data["schema"]
            and isinstance(data["schema"]["fields"], list)
        )

    def _parse_iceberg_delta_schema(self, data: dict) -> List[Column]:  # noqa: UP006
        """
        Parse Iceberg/Delta Lake metadata file schema to extract columns.
        """
        columns = []
        schema = data.get("schema", {})
        fields = schema.get("fields", [])

        for field in fields:
            try:
                column_name = field.get("name", "")
                column_type = field.get("type", "string")

                # Get the type string from dict if needed
                type_str = column_type
                if isinstance(column_type, dict):
                    type_str = column_type.get("type", "string")

                # Use DataType enum directly - it will handle the conversion
                try:
                    data_type = DataType(type_str.upper()) if isinstance(type_str, str) else DataType.STRING
                except (ValueError, AttributeError) as exc:
                    # If the type is not recognized, default to STRING
                    logger.debug(
                        f"Unrecognized data type '{type_str}' for column '{column_name}': {exc}. Defaulting to STRING."
                    )
                    data_type = DataType.STRING

                column = Column(
                    name=truncate_column_name(column_name),
                    displayName=column_name,
                    dataType=data_type,
                    dataTypeDisplay=(column_type if isinstance(column_type, str) else str(column_type)),
                )

                # Handle nested struct types
                if isinstance(column_type, dict) and column_type.get("type") == "struct":
                    column.children = self._parse_struct_fields(column_type.get("fields", []))
                    column.dataType = DataType.STRUCT

                columns.append(column)
            except Exception as exc:
                logger.warning(f"Unable to parse field {field}: {exc}")
                logger.debug(traceback.format_exc())

        return columns

    def _parse_struct_fields(self, fields: list) -> List[dict]:  # noqa: UP006
        """
        Parse nested struct fields in Iceberg/Delta Lake metadata.
        """
        children = []
        for field in fields:
            try:
                child_name = field.get("name", "")
                child_type = field.get("type", "string")

                # Get the type string from dict if needed
                type_str = child_type
                if isinstance(child_type, dict):
                    type_str = child_type.get("type", "string")

                # Use DataType enum directly
                try:
                    data_type = DataType(type_str.upper()) if isinstance(type_str, str) else DataType.STRING
                except (ValueError, AttributeError) as exc:
                    logger.debug(
                        f"Unrecognized data type '{type_str}' for nested field '{child_name}': {exc}. "
                        f"Defaulting to STRING."
                    )
                    data_type = DataType.STRING

                child = {
                    "name": truncate_column_name(child_name),
                    "displayName": child_name,
                    "dataType": data_type.value,
                    "dataTypeDisplay": (child_type if isinstance(child_type, str) else str(child_type)),
                }

                # Recursively handle nested structs
                if isinstance(child_type, dict) and child_type.get("type") == "struct":
                    child["children"] = self._parse_struct_fields(child_type.get("fields", []))

                children.append(child)
            except Exception as exc:
                logger.warning(f"Unable to parse nested field {field}: {exc}")
                logger.debug(traceback.format_exc())

        return children
