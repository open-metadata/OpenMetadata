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

import logging
import sys
from typing import Iterable, List, Optional

import click
from metadata.ingestion.models.table_queries import TableUsageCount, TableUsageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.utils.fqdn_generator import get_fqdn
from metadata.utils.logger import ingestion_logger
from metadata.utils.connections import (
    get_connection,
    test_connection,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.entity.data.table import (
    SqlQuery,
    Table,
    TableJoins,
)
from ..models.table_metadata import DatabaseAndTableState, TableUsageMetadata

logger = ingestion_logger()

TABLE_USAGE_REQUEST_TEMPLATE = """
select cm.catalogname as c, cm.schemaname as s, cm.tablename as t, date (qm.createtime) as d, count(*) as cnt
from {catalog}.{database}.column_metrics as cm
inner join {catalog}.{database}.query_metrics as qm on cm.queryid = qm.queryid
where and qm.createtime > now() - interval '30' day
group by (cm.catalogname, cm.schemaname, cm.tablename, date (qm.createtime))
"""

SAMPLE_QUERIES_REQUEST_TEMPLATE = """
with qc as (
 select catalogname as c, schemaname as s, tablename as t, MAX(query) as q, AVG(executiontime) as d, COUNT(*) as q_cnt
 from {catalog}.{database}.column_metrics as cm
 inner join {catalog}.{database}.query_metrics as qm on cm.queryid = qm.queryid
 where qm.querytype = 'SELECT' -- only selects
  and qm.query not like '%%EXECUTE%%' -- execute querries are no use as samples
  and cm.schemaname not like '%i%nformation_schemata%%' -- these are automated
  and cm.catalogname not like '%%info_schema%%' and cm.catalogname not like '%%system%%'
 group by (cm.catalogname, cm.schemaname, cm.tablename, regexp_replace(qm.query, '/\+s/g', ''))
 ),
qr as (
 select qc.c, qc.s, qc.t, qc.q, qc.d, RANK() over (
   partition by (qc.c, qc.s, qc.t) order by qc.q_cnt desc
   ) as r, qc.q_cnt
 from qc
 where (qc.q, qc.q_cnt) = any (
   select _qc.q, MAX(_qc.q_cnt)
   from qc as _qc
   group by _qc.q
   )
 )
select qr.c, qr.s, qr.s, ARRAY_AGG(qr.q) as q, AVG(d) as d
from qr
where qr.r <= 5
group by (qr.c, qr.s, qr.t);
"""

class TrinoUsageSource(Source[TableUsageMetadata]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        try:
            from trino import (
                dbapi,  # pylint: disable=import-outside-toplevel,unused-import
            )
        except ModuleNotFoundError:
            click.secho(
                "Trino source dependencies are missing. Please run\n"
                + "$ pip install --upgrade 'openmetadata-ingestion[trino]'",
                fg="red",
            )
            if logger.isEnabledFor(logging.DEBUG):
                raise
            sys.exit(1)

        self.config = config
        self.trino_config: TrinoConnection = config.sourceConfig.config

        self.service_connection = self.config.serviceConnection.__root__.config

        self.status = SourceStatus()
        self.metadata = OpenMetadata(metadata_config)

        self.engine = get_connection(self.service_connection)
        self.test_connection()

        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: TrinoConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TrinoConnection):
            raise InvalidSourceException(
                f"Expected TrinoConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[TableUsageMetadata]:
        yield from self._get_table_usage_counts()
        yield from self._get_sample_queries()

    def _get_table_usage_counts(self) -> Iterable[TableUsageMetadata]:
        with self.engine.connect() as conn:
            result = conn.execute(
                TABLE_USAGE_REQUEST_TEMPLATE.format(
                    catalog=self.trino_config.catalog,
                    database=self.trino_config.database,
                )
            )
        for row in result:
            if table := self.__get_table(row['c'], row['s'], row['t']):
                self.status.records(row)
                yield TableUsageMetadata(
                    table=table,
                    metadata=TableUsageRequest(date=row['date'].strftime("%Y-%m-%d"), count=row['cnt'])
                )
            else:
                self.status.warning(self.config.serviceName, f"Could not find Trino table {row['c']}.{row['s']}.{row['t']} in OpenMetadata")

    def _get_sample_queries(self) -> Iterable[TableUsageMetadata]:
        with self.engine.connect() as conn:
            result = conn.execute(
                SAMPLE_QUERIES_REQUEST_TEMPLATE.format(
                    catalog=self.trino_config.catalog,
                    database=self.trino_config.database,
                )
            )
        for row in result:
            if table := self.__get_table(row['c'], row['s'], row['t']):
                self.status.scanned(row)
                yield TableUsageMetadata(
                    table=table,
                    metadata=[SqlQuery(query=q) for q in row['q']]
                )
            else:
                self.status.warning(self.config.serviceName, f"Could not find Trino table {row['c']}.{row['s']}.{row['t']} in OpenMetadata")

    def __get_table(self, database: str, database_schema: str, name: str) -> Optional[Table]:
        tables = self.metadata.search_entities_using_es(
            service_name=self.config.serviceName,
            table_obj={
                "database": database,
                "database_schema": database_schema,
                "name": name,
            },
            search_index="table_search_index",
        )
        return tables[0] if tables else None

    def preare(self) -> None:
        pass

    def test_connection(self) -> None:
        test_connection(self.engine)

    def get_status(self) -> SourceStatus:
        return self.status
