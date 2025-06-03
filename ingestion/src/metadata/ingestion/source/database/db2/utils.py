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
Module to define overriden dialect methods
"""
from sqlalchemy import and_, join, sql
from sqlalchemy.engine import reflection


@reflection.cache
def get_unique_constraints(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    """Small Method to override the Dialect default as it is not filtering properly the Schema and Table Name."""
    current_schema = self.denormalize_name(schema or self.default_schema_name)
    table_name = self.denormalize_name(table_name)
    syskeycol = self.sys_keycoluse
    sysconst = self.sys_tabconst
    query = (
        sql.select(syskeycol.c.constname, syskeycol.c.colname)
        .select_from(
            join(
                syskeycol,
                sysconst,
                and_(
                    syskeycol.c.constname == sysconst.c.constname,
                    syskeycol.c.tabschema == sysconst.c.tabschema,
                    syskeycol.c.tabname == sysconst.c.tabname,
                ),
            )
        )
        .where(
            and_(
                sysconst.c.tabname == table_name,
                sysconst.c.tabschema == current_schema,
                sysconst.c.type == "U",
            )
        )
        .order_by(syskeycol.c.constname)
    )
    unique_consts = []
    curr_const = None
    for r in connection.execute(query):
        if curr_const == r[0]:
            unique_consts[-1]["column_names"].append(self.normalize_name(r[1]))
        else:
            curr_const = r[0]
            unique_consts.append(
                {
                    "name": self.normalize_name(curr_const),
                    "column_names": [self.normalize_name(r[1])],
                }
            )
    return unique_consts
