-- Remove Duplicate FullyQualifiedName and lowercase
WITH cte AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName'))) ORDER BY id) as rn
    FROM 
        user_entity
)
DELETE FROM user_entity
WHERE id IN (
    SELECT id
    FROM cte
    WHERE rn > 1
);

UPDATE user_entity
SET json = JSON_SET(
    json,
    '$.fullyQualifiedName',
    LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')))
);

UPDATE user_entity SET nameHash = MD5(JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')));
