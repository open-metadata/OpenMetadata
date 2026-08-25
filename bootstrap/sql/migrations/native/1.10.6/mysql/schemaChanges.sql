-- Migrate Airbyte connections from flat username/password to auth object structure
UPDATE pipeline_service_entity
SET
    json = JSON_SET (
        JSON_REMOVE (
            json,
            '$.connection.config.username',
            '$.connection.config.password'
        ),
        '$.connection.config.auth',
        JSON_OBJECT (
            'username',
            JSON_UNQUOTE (
                JSON_EXTRACT (json, '$.connection.config.username')
            ),
            'password',
            JSON_UNQUOTE (
                JSON_EXTRACT (json, '$.connection.config.password')
            )
        )
    )
WHERE
    JSON_EXTRACT (json, '$.serviceType') = 'Airbyte';