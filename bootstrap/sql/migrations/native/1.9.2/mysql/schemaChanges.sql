-- Update entity_extension to move domain to array
update entity_extension set json = JSON_SET(
    JSON_REMOVE(json, '$.domain'),
    '$.domains',
    JSON_ARRAY(
        JSON_EXTRACT(json, '$.domain')
    )
) where json -> '$.domain' is not null;
