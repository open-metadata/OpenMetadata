REDSHIFT_SQL_STATEMENT = """
        SELECT DISTINCT ss.userid,
            ss.query,
            sui.usename,
            ss.tbl,
            sq.querytxt,
            sti.database,
            sti.schema,
            sti.table,
            sq.starttime,
            sq.endtime,
            sq.aborted
        FROM stl_scan ss
            JOIN svv_table_info sti ON ss.tbl = sti.table_id
            JOIN stl_query sq ON ss.query = sq.query
            JOIN svl_user_info sui ON sq.userid = sui.usesysid
        WHERE ss.starttime >= '{start_time}'
            AND ss.starttime < '{end_time}'
            AND sq.aborted = 0
        ORDER BY ss.endtime DESC;
    """


SNOWFLAKE_SQL_STATEMENT = """
        select query_type,query_text,user_name,database_name,
        schema_name,start_time,end_time
        from table(information_schema.query_history(
        end_time_range_start=>to_timestamp_ltz('{start_date}'),
        end_time_range_end=>to_timestamp_ltz('{end_date}')));
        """
