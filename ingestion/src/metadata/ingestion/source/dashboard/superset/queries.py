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
Queries to fetch data from superset
"""

FETCH_ALL_CHARTS = """
select 
	s.id,
	s.slice_name,
	s.description,
	t.table_name,
	t.schema,
	db.database_name,
    db.sqlalchemy_uri
from 
	slices s left join "tables" t 
on	s.datasource_id  = t.id and s.datasource_type = 'table' 
	left join "dbs" db 
on  db.id = t.database_id
"""


FETCH_DASHBOARDS = """
select
	d.id, 
	d.dashboard_title, 
	d.position_json,
	au.email 
from 
	dashboards d
LEFT JOIN
	ab_user au
ON
	d.created_by_fk = au.id
"""
