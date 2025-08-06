import textwrap

EXASOL_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
      s.sql_text "query_text",
      s.command_name "query_type",
      se.user_name "user_name",
      s.start_time "start_time",
      s.stop_time "end_time",
      s.duration "duration"
    FROM EXA_DBA_AUDIT_SQL s
    JOIN EXA_DBA_AUDIT_SESSIONS se
    ON s.SESSION_ID = se.SESSION_ID
    WHERE s.sql_text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%' 
    AND s.sql_text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND start_time between TO_TIMESTAMP('{start_time}') and TO_TIMESTAMP('{end_time}')
    {filters}
    LIMIT {result_limit}
    """
)

EXASOL_TEST_GET_QUERIES = """
    SELECT
      s.sql_text,
      s.command_name,
      se.user_name,
      s.start_time,
      s.stop_time,
      s.duration
    FROM EXA_DBA_AUDIT_SQL s
    JOIN EXA_DBA_AUDIT_SESSIONS se
    ON s.SESSION_ID = se.SESSION_ID
    LIMIT 1
    """
