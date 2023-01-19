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
SQL Queries used during ingestion
"""

ORACLE_ALL_TABLE_COMMENTS = """
SELECT 
	comments table_comment,
	table_name,
	owner "schema" 	
FROM all_tab_comments
where comments is not null and owner not in ('SYSTEM', 'SYS')
"""


ORACLE_ALL_VIEW_DEFINITIONS = """
SELECT 
	view_name, 
	owner "schema",
	text view_def 
FROM all_views 
where text is not null and owner not in ('SYSTEM', 'SYS')
"""
