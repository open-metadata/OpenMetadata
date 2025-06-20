"""
SQL queries for Unity Catalog
"""

UNITY_CATALOG_GET_CATALOGS_TAGS = """
SELECT * FROM `{database}`.information_schema.catalog_tags;
"""

UNITY_CATALOG_GET_ALL_SCHEMA_TAGS = """
SELECT * FROM `{database}`.information_schema.schema_tags;
"""

UNITY_CATALOG_GET_ALL_TABLE_TAGS = """
SELECT * FROM `{database}`.information_schema.table_tags WHERE schema_name = '{schema}';
"""

UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS = """
SELECT * FROM `{database}`.information_schema.column_tags WHERE schema_name = '{schema}';
"""
