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

-- Upgrade appliedAt to microsecond precision to match PostgreSQL behavior.
-- Without this, MySQL returns second-precision timestamps which cause spurious
-- diffs in JSON patch operations, leading to deserialization failures.
ALTER TABLE tag_usage MODIFY appliedAt TIMESTAMP(6) NULL DEFAULT CURRENT_TIMESTAMP(6);