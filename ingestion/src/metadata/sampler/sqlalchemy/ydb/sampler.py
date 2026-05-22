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
YDB-specific SQLAlchemy sampler.

YDB has no SQL schemas — every object lives at a directory path like
``jaffle_shop/customers``. The default SQA ORM builder generates queries as
``schema.table`` (``jaffle_shop.customers``), which YDB rejects with
"Unknown cluster". This sampler builds the ORM class with the full YDB path
as the table name and no schema, so generated SQL becomes
``FROM `jaffle_shop/customers``` — the form YDB accepts.
"""

from typing import Optional

from pydantic import BaseModel
from sqlalchemy import MetaData
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.ydb.utils import full_name
from metadata.profiler.metrics.static.mean import AvgFn
from metadata.profiler.orm.converter.base import (
    SQA_RESERVED_ATTRIBUTES,
    Base,
    build_orm_col,
)
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import Dialects
from metadata.sampler.sqlalchemy.sampler import RANDOM_LABEL, SQASampler


@compiles(AvgFn, Dialects.YDB)
def _ydb_avg(element, compiler, **kw):
    """Wrap AVG arguments in CAST(... AS Double).

    YQL refuses ``avg(Decimal)``; the cast is a no-op for Float/Double and
    safe for integer types. The profiler only invokes AVG on quantifiable
    types so the cast is always defined.
    """
    return "avg(CAST(%s AS Double))" % compiler.process(element.clauses, **kw)  # noqa: UP031


class YdbSampler(SQASampler):
    """SQA sampler that builds ORM classes with YDB-native path identifiers."""

    def get_sample_query(
        self, static: StaticSamplingConfig | None, *, column=None
    ) -> Query:
        """Mirror of :py:meth:`SQASampler.get_sample_query` adapted for YDB.

        Two YQL-specific deviations from the base implementation:

        * **Subqueries instead of CTEs.** Some YDB releases reject
          ``WITH ... AS (...) SELECT ...`` at the top level
          (``mismatched input 'WITH'``). ``FROM (SELECT ...) AS x`` is
          accepted everywhere and downstream consumers
          (``inspect(ds).c`` / ``select_from(ds)``) work identically for
          ``CTE`` and ``Subquery``.

        * **No ``ORDER BY random`` in the sample subquery.** YQL raises
          ``ORDER BY without LIMIT in subquery will be ignored`` (issue 4504)
          when a subquery has ``ORDER BY`` but no ``LIMIT``. The
          ``RandomNumFn`` compile override for YDB emits ``0`` (see
          ``random_num.py``), so the order would be over a constant column
          anyway — dropping it removes the warning with no behavioural
          change.
        """
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)  # type: ignore
        with self.session_factory() as client:
            if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
                rnd = self._base_sample_query(
                    selectable,
                    column,
                    (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                ).subquery(f"{self.get_sampler_table_name()}_rnd")
                session_query = client.query(rnd).where(
                    rnd.c.random <= static.profileSample
                )
                return session_query.subquery(
                    f"{self.get_sampler_table_name()}_sample"
                )

            session_query = self._base_sample_query(selectable, column, None)
            return session_query.limit(
                static.profileSample if static else None
            ).subquery(f"{self.get_sampler_table_name()}_rnd")

    def build_table_orm(
        self,
        table: Table,
        service_conn_config: BaseModel,
        ometa_client: OpenMetadata,
    ) -> Optional[type]:  # noqa: UP045
        if not table.columns:
            return None

        schema = ometa_client.get_by_id(
            entity=DatabaseSchema, entity_id=table.databaseSchema.id
        )
        schema_name = str(schema.name.root)
        table_name = str(table.name.root)
        ydb_path = full_name(schema_name, table_name)

        # ORM class name must be a valid Python identifier — strip the slashes.
        orm_class_name = f"ydb_{schema_name}_{table_name}".replace("/", "_").replace(
            ".", "_"
        )

        cols = {
            (
                col.name.root + "_"
                if col.name.root in SQA_RESERVED_ATTRIBUTES
                else col.name.root
            ): build_orm_col(idx, col, table.serviceType)
            for idx, col in enumerate(table.columns)
        }

        return type(
            orm_class_name,
            (Base,),
            {
                "__tablename__": ydb_path,
                "__table_args__": {
                    "schema": None,
                    "extend_existing": True,
                    "quote": True,
                },
                **cols,
                "metadata": MetaData(),
            },
        )
