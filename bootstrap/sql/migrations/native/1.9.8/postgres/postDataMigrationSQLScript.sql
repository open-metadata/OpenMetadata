-- Migrate individual profile data to EntityProfile format
UPDATE profiler_data_time_series pdts
SET json = jsonb_build_object(
    'id', gen_random_uuid(),
    'entityReference', jsonb_build_object(
        'id', te.json ->> 'id',
        'type', 'table',
        'fullyQualifiedName', te.json ->> 'fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType',
    (CASE pdts.extension
        WHEN 'table.tableProfile' THEN 'table'
        WHEN 'table.columnProfile' THEN 'column'
        WHEN 'table.systemProfile' THEN 'system'
    END)
)
FROM table_entity te
WHERE (
    pdts.entityFQNHash = te.fqnHash OR
    pdts.entityFQNHash LIKE CONCAT(te.fqnHash, '.%')
);