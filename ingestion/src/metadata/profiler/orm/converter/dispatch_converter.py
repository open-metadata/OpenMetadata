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
Dispatch logic to map an Converter base based on dialect
"""
import sqlalchemy

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.orm.converter.bigquery.converter import BigqueryMapTypes
from metadata.profiler.orm.converter.snowflake.converter import SnowflakeMapTypes

converter_registry = {
    DatabaseServiceType.BigQuery: BigqueryMapTypes,
    DatabaseServiceType.Snowflake: SnowflakeMapTypes,
}


def build_orm_col(idx: int, col: Column, table_service_type) -> sqlalchemy.Column:
    """
    Cook the ORM column from our metadata instance
    information.

    The first parsed column will be used arbitrarily
    as the PK, as SQLAlchemy forces us to specify
    at least one PK.

    As this is only used for INSERT/UPDATE/DELETE,
    there is no impact for our read-only purposes.
    """
    # pylint: disable=import-outside-toplevel
    from metadata.profiler.orm.converter.base import (
        check_if_should_quote_column_name,
        check_snowflake_case_sensitive,
    )
    from metadata.profiler.orm.converter.common import CommonMapTypes

    return sqlalchemy.Column(
        name=str(col.name.__root__),
        type_=converter_registry.get(table_service_type, CommonMapTypes)().map_types(
            col, table_service_type
        ),
        primary_key=not bool(idx),  # The first col seen is used as PK
        quote=check_if_should_quote_column_name(table_service_type)
        or check_snowflake_case_sensitive(table_service_type, col.name.__root__),
        key=str(
            col.name.__root__
        ).lower(),  # Add lowercase column name as key for snowflake case sensitive columns
    )
