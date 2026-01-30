-- Migrate Salesforce connection from sobjectName (string) to sobjectNames (array)
-- Converts sobjectName to sobjectNames array and removes the old field
UPDATE dbservice_entity
SET
    json = JSON_REMOVE (
        JSON_SET (
            json,
            '$.connection.config.sobjectNames',
            JSON_ARRAY (
                JSON_UNQUOTE (
                    JSON_EXTRACT (json, '$.connection.config.sobjectName')
                )
            )
        ),
        '$.connection.config.sobjectName'
    )
WHERE
    serviceType = 'Salesforce'
    AND JSON_TYPE (
        JSON_EXTRACT (json, '$.connection.config.sobjectName')
    ) != 'NULL';