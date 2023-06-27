import textwrap

BIGQUERY_TABLESAMPLE = textwrap.dedent(
    """
  WITH {table}_cte AS ( 
    SELECT {col}
    FROM `{relative_table}` TABLESAMPLE SYSTEM ({percent} PERCENT)
  )
  SELECT * FROM {table}_cte
  LIMIT {result_limit}
"""
)
