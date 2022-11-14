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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""


from datetime import datetime
from typing import Dict, Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import Column, MetaData, inspect
from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import PartitionProfilerConfig
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeType,
)
from metadata.orm_profiler.orm.converter import ometa_to_sqa_orm
from metadata.utils.connections import get_connection
from metadata.utils.sql_queries import SNOWFLAKE_SESSION_TAG_QUERY


class SQAInterfaceMixin:
    """SQLAlchemy inteface mixin grouping shared methods between sequential and threaded executor"""

    @property
    def table(self):
        """OM Table entity"""
        return self._table

    def _get_engine(self):
        """Get engine for database

        Args:
            service_connection_config: connection details for the specific service
        Returns:
            sqlalchemy engine
        """
        engine = get_connection(self.service_connection_config)

        return engine

    def _convert_table_to_orm_object(
        self,
        sqa_metadata_obj: Optional[MetaData] = None,
    ) -> DeclarativeMeta:
        """Given a table entity return a SQA ORM object

        Args:
            sqa_metadata_obj: sqa metadata registry
        Returns:
            DeclarativeMeta
        """
        return ometa_to_sqa_orm(self.table_entity, self.ometa_client, sqa_metadata_obj)

    def get_columns(self) -> Column:
        """get columns from an orm object"""
        return inspect(self.table).c

    def set_session_tag(self, session) -> None:
        """
        Set session query tag for snowflake

        Args:
            service_connection_config: connection details for the specific service
        """
        if (
            self.service_connection_config.type.value == SnowflakeType.Snowflake.value
            and hasattr(self.service_connection_config, "queryTag")
            and self.service_connection_config.queryTag
        ):
            session.execute(
                SNOWFLAKE_SESSION_TAG_QUERY.format(
                    query_tag=self.service_connection_config.queryTag
                )
            )

    def get_partition_details(
        self, partition_config: Optional[PartitionProfilerConfig]
    ) -> Optional[Dict]:
        """From partition config, get the partition table for a table entity

        Args:
            partition_config: PartitionProfilerConfig object with some partition details

        Returns:
            dict or None: dictionnary with all the elements constituing the a partition
        """
        if not partition_config:
            return None

        timedelta_mapping = {
            "YEAR": "years",
            "MONTH": "months",
            "DAY": "days",
            "HOUR": "hours",
        }

        timedelta_dict = {
            timedelta_mapping.get(
                partition_config.partitionIntervalUnit.value, "days"
            ): partition_config.partitionInterval
            or 1
        }

        end = datetime.utcnow()
        start = end - relativedelta(**timedelta_dict)
        return {
            "partition_field": partition_config.partitionColumnName,
            "partition_start": start,
            "partition_end": end,
            "partition_values": partition_config.partitionValues,
        }

    def close(self):
        """close session"""
        self.session.close()
