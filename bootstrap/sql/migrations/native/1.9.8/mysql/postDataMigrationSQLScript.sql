-- Migrate individual profile data to EntityProfile format
UPDATE profiler_data_time_series pdts
INNER JOIN table_entity te ON (
    pdts.entityFQNHash = te.fqnHash OR
    pdts.entityFQNHash LIKE CONCAT(te.fqnHash, '.%')
)
SET pdts.json = JSON_OBJECT(
    'id', UUID(),
    'entityReference', JSON_OBJECT(
        'id', te.json -> '$.id',
        'type', 'table',
        'fullyQualifiedName', te.json -> '$.fullyQualifiedName',
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
);
