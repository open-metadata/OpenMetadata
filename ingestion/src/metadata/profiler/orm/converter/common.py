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
Common Class For Profiler Converter.
"""
from typing import Dict, Set

import sqlalchemy
from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.ingestion.source import sqa_types
from metadata.profiler.orm.registry import CustomTypes


class CommonMapTypes:
    """
    Base Class for mapping types
    """

    _TYPE_MAP = {
        DataType.NUMBER: sqlalchemy.NUMERIC,
        DataType.TINYINT: sqlalchemy.SMALLINT,
        DataType.SMALLINT: sqlalchemy.SMALLINT,
        DataType.INT: sqlalchemy.INT,
        DataType.BIGINT: sqlalchemy.BIGINT,
        DataType.BYTEINT: sqlalchemy.SMALLINT,
        DataType.BYTES: CustomTypes.BYTES.value,
        DataType.FLOAT: sqlalchemy.FLOAT,
        DataType.DOUBLE: sqlalchemy.DECIMAL,
        DataType.DECIMAL: sqlalchemy.DECIMAL,
        DataType.NUMERIC: sqlalchemy.NUMERIC,
        DataType.TIMESTAMP: CustomTypes.TIMESTAMP.value,
        DataType.TIME: sqlalchemy.TIME,
        DataType.DATE: sqlalchemy.DATE,
        DataType.DATETIME: sqlalchemy.DATETIME,
        DataType.INTERVAL: sqlalchemy.Interval,
        DataType.STRING: sqlalchemy.String,
        DataType.MEDIUMTEXT: sqlalchemy.TEXT,
        DataType.TEXT: sqlalchemy.TEXT,
        DataType.CHAR: sqlalchemy.CHAR,
        DataType.VARCHAR: sqlalchemy.VARCHAR,
        DataType.BOOLEAN: sqlalchemy.BOOLEAN,
        DataType.BINARY: CustomTypes.BYTES.value,
        DataType.VARBINARY: CustomTypes.BYTES.value,
        DataType.ARRAY: CustomTypes.ARRAY.value,
        DataType.BLOB: CustomTypes.BYTES.value,
        DataType.LONGBLOB: sqlalchemy.LargeBinary,
        DataType.MEDIUMBLOB: sqlalchemy.LargeBinary,
        DataType.MAP: sqa_types.SQAMap,
        DataType.STRUCT: sqa_types.SQAStruct,
        DataType.UNION: sqa_types.SQAUnion,
        DataType.SET: sqa_types.SQASet,
        DataType.GEOGRAPHY: sqa_types.SQASGeography,
        DataType.ENUM: sqlalchemy.Enum,
        DataType.JSON: sqlalchemy.JSON,
        DataType.UUID: CustomTypes.UUID.value,
        DataType.BYTEA: CustomTypes.BYTEA.value,
        DataType.NTEXT: sqlalchemy.NVARCHAR,
        DataType.IMAGE: CustomTypes.IMAGE.value,
        DataType.IPV4: CustomTypes.IP.value,
        DataType.IPV6: CustomTypes.IP.value,
        DataType.DATETIMERANGE: CustomTypes.SQADATETIMERANGE.value,
    }

    def map_types(self, col: Column, table_service_type):
        """returns an ORM type"""

        if col.arrayDataType:
            return self._TYPE_MAP.get(col.dataType)(item_type=col.arrayDataType)
        return self.return_custom_type(col, table_service_type)

    def return_custom_type(self, col: Column, _):
        return self._TYPE_MAP.get(col.dataType, CustomTypes.UNDETERMINED.value)

    @staticmethod
    def map_sqa_to_om_types() -> Dict[TypeEngine, Set[DataType]]:
        """returns an ORM type"""
        return {
            sqlalchemy.NUMERIC: {DataType.NUMBER, DataType.NUMERIC},
            sqlalchemy.SMALLINT: {
                DataType.TINYINT,
                DataType.SMALLINT,
                DataType.BYTEINT,
            },
            sqlalchemy.INT: {DataType.INT},
            sqlalchemy.BIGINT: {DataType.BIGINT},
            CustomTypes.BYTES.value: {DataType.BLOB, DataType.BYTES},
            sqlalchemy.FLOAT: {DataType.FLOAT},
            sqlalchemy.DECIMAL: {DataType.DOUBLE, DataType.DECIMAL},
            CustomTypes.TIMESTAMP.value: {DataType.TIMESTAMP},
            sqlalchemy.TIME: {DataType.TIME},
            sqlalchemy.DATE: {DataType.DATE},
            sqlalchemy.DATETIME: {DataType.DATETIME},
            sqlalchemy.Interval: {DataType.INTERVAL},
            sqlalchemy.String: {DataType.STRING},
            sqlalchemy.TEXT: {DataType.TEXT, DataType.MEDIUMTEXT},
            sqlalchemy.CHAR: {DataType.CHAR},
            sqlalchemy.VARCHAR: {DataType.VARCHAR},
            sqlalchemy.BOOLEAN: {DataType.BOOLEAN},
            sqlalchemy.LargeBinary: {
                DataType.MEDIUMBLOB,
                DataType.BINARY,
                DataType.LONGBLOB,
            },
            sqlalchemy.VARBINARY: {DataType.VARBINARY},
            CustomTypes.ARRAY.value: {DataType.ARRAY},
            sqa_types.SQAMap: {DataType.MAP},
            sqa_types.SQAStruct: {DataType.STRUCT},
            sqa_types.SQAUnion: {DataType.UNION},
            sqa_types.SQASet: {DataType.SET},
            sqa_types.SQASGeography: {DataType.GEOGRAPHY},
            sqlalchemy.Enum: {DataType.ENUM},
            sqlalchemy.JSON: {DataType.JSON},
            CustomTypes.UUID.value: {DataType.UUID},
            CustomTypes.BYTEA.value: {DataType.BYTEA},
            sqlalchemy.NVARCHAR: {DataType.NTEXT},
            CustomTypes.IMAGE.value: {DataType.IMAGE},
            CustomTypes.IP.value: {DataType.IPV6, DataType.IPV4},
            CustomTypes.SQADATETIMERANGE.value: {DataType.DATETIMERANGE},
        }
