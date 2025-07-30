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
