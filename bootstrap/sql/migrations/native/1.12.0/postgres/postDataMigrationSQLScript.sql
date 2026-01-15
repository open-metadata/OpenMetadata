UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedServices}',
    '["Snowflake", "BigQuery", "Athena", "Redshift", "Postgres", "MySQL", "Mssql", "Oracle", "Trino", "SapHana"]'::jsonb
)
WHERE name = 'tableDiff'
  AND (
    json->'supportedServices' IS NULL
    OR json->'supportedServices' = '[]'::jsonb
  );

-- Add parameters back in tableRowInsertedCountToBeBetween if missing
UPDATE test_definition
SET json = jsonb_set(
    json,
    '{parameterDefinition}',
    (
        SELECT jsonb_agg(elem)
        FROM (
            -- Keep existing elements
            SELECT elem
            FROM jsonb_array_elements(json -> 'parameterDefinition') AS elem
            
            UNION ALL
            
            -- Add columnName if not exists
            SELECT jsonb_build_object(
                'name', 'columnName',
                'dataType', 'STRING',
                'required', true,
                'description', 'Name of the Column to check for new rows inserted.',
                'displayName', 'Column Name',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'columnName'
            )
            
            UNION ALL
            
            -- Add rangeType if not exists
            SELECT jsonb_build_object(
                'name', 'rangeType',
                'dataType', 'STRING',
                'required', true,
                'description', 'One of ''HOUR'', ''DAY'', ''MONTH'', ''YEAR'' to specify the range type for checking new rows inserted.',
                'displayName', 'Range Type',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'rangeType'
            )
            
            UNION ALL
            
            -- Add rangeInterval if not exists
            SELECT jsonb_build_object(
                'name', 'rangeInterval',
                'dataType', 'INT',
                'required', true,
                'description', 'Interval Range. E.g. if rangeInterval=1 and rangeType=DAY, we''ll check the numbers of rows inserted where columnName=-1 DAY',
                'displayName', 'Interval',
                'optionValues', '[]'::jsonb
            )
            WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(json -> 'parameterDefinition') AS e
                WHERE e ->> 'name' = 'rangeInterval'
            )
        ) AS combined
    )
)
WHERE json ->> 'name' = 'tableRowInsertedCountToBeBetween';
