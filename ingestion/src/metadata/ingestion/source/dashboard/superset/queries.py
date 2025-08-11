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
Queries to fetch data from superset
"""


FETCH_ALL_CHARTS = """
select 
	s.id,
	s.slice_name,
	s.description,
    	s.datasource_id,
    	s.viz_type,
	t.id AS table_id,
	t.table_name,
	t.schema,
	t.sql,
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
    	d.published,
	au.email 
from 
	dashboards d
LEFT JOIN
	ab_user au
ON
	d.created_by_fk = au.id
"""

FETCH_PUBLISHED_DASHBOARDS = """
select
	d.id, 
	d.dashboard_title, 
	d.position_json,
    	d.published,
	au.email 
from 
	dashboards d
LEFT JOIN
	ab_user au
ON
	d.created_by_fk = au.id
where 
	d.published=true
"""

FETCH_ALL_CHARTS_TEST = """
select 
	s.id
from 
	slices s left join "tables" t 
on	s.datasource_id  = t.id and s.datasource_type = 'table' 
	left join "dbs" db 
on  db.id = t.database_id
LIMIT 1
"""


FETCH_DASHBOARDS_TEST = """
select
	d.id
from 
	dashboards d
LEFT JOIN
	ab_user au
ON
	d.created_by_fk = au.id
LIMIT 1
"""

FETCH_COLUMN = """
select 
	tc.id, 
    	t.table_name ,
    	tc.column_name, 
		tc.table_id, 
    	tc.type,
    	tc.description 
from 
	table_columns  tc  
inner join 
	tables t 
on 
	t.id=tc.table_id  
where 
	tc.table_id=%(table_id)s
"""
