-- Migration script to restructure Databricks connection configuration
-- Move 'token' field from connection.config.token to connection.config.authType.token
UPDATE dbservice_entity
SET
    json = JSON_SET (
        JSON_REMOVE (json, '$.connection.config.token'),
        '$.connection.config.authType',
        JSON_OBJECT (
            'token',
            JSON_EXTRACT (json, '$.connection.config.token')
        )
    )
WHERE
    serviceType in ('Databricks', 'UnityCatalog')
    AND JSON_CONTAINS_PATH(json, 'one', '$.connection.config.token');

-- Migration to remove .png extension from appScreenshots in apps tables
-- Part of fixing appScreenshots extension handling change

-- Update apps_marketplace table - remove .png extension from appScreenshots only
UPDATE apps_marketplace 
SET json = JSON_SET(
    json,
    '$.appScreenshots',
    JSON_EXTRACT(
        REPLACE(JSON_EXTRACT(json, '$.appScreenshots'), '.png"', '"'),
        '$'
    )
)
WHERE json IS NOT NULL
  AND JSON_EXTRACT(json, '$.appScreenshots') IS NOT NULL
  AND JSON_LENGTH(JSON_EXTRACT(json, '$.appScreenshots')) > 0
  AND JSON_EXTRACT(json, '$.appScreenshots') LIKE '%.png%';

-- Update installed_apps table - remove .png extension from appScreenshots only
UPDATE installed_apps 
SET json = JSON_SET(
    json,
    '$.appScreenshots',
    JSON_EXTRACT(
        REPLACE(JSON_EXTRACT(json, '$.appScreenshots'), '.png"', '"'),
        '$'
    )
)
WHERE json IS NOT NULL
  AND JSON_EXTRACT(json, '$.appScreenshots') IS NOT NULL
  AND JSON_LENGTH(JSON_EXTRACT(json, '$.appScreenshots')) > 0
  AND JSON_EXTRACT(json, '$.appScreenshots') LIKE '%.png%';

-- Update apps_data_store table - remove .png extension from appScreenshots only
UPDATE apps_data_store 
SET json = JSON_SET(
    json,
    '$.appScreenshots',
    JSON_EXTRACT(
        REPLACE(JSON_EXTRACT(json, '$.appScreenshots'), '.png"', '"'),
        '$'
    )
)
WHERE json IS NOT NULL
  AND JSON_EXTRACT(json, '$.appScreenshots') IS NOT NULL
  AND JSON_LENGTH(JSON_EXTRACT(json, '$.appScreenshots')) > 0
  AND JSON_EXTRACT(json, '$.appScreenshots') LIKE '%.png%';